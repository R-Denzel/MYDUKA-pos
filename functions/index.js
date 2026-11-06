const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { defineString } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

initializeApp();

const db = getFirestore();
const premiumAdminEmails = defineString('PREMIUM_ADMIN_EMAILS');

async function isConfiguredAdmin(uid) {
  const adminEmails = premiumAdminEmails.value()
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const account = await getAuth().getUser(uid);
  return Boolean(
    account.email &&
    account.emailVerified &&
    adminEmails.includes(account.email.toLowerCase()),
  );
}

exports.notifyOwnerOfSale = onDocumentCreated('sales/{saleId}', async (event) => {
  const sale = event.data?.data();
  if (!sale?.ownerUid) return;

  const devices = await db.collection(`users/${sale.ownerUid}/devices`).get();
  const tokens = devices.docs.map((device) => device.id);
  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Sale completed',
      body: `A sale of UGX ${Number(sale.total || 0).toLocaleString('en-UG')} was recorded.`,
    },
    data: { saleId: event.params.saleId },
    webpush: { fcmOptions: { link: '/' } },
  });

  const removals = response.responses.flatMap((result, index) =>
    result.success
      ? []
      : result.error?.code === 'messaging/registration-token-not-registered'
        ? [devices.docs[index].ref.delete()]
        : [],
  );
  await Promise.all(removals);
});

exports.checkAdminAccess = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to check administrator access.');
  }
  return { isAdmin: await isConfiguredAdmin(request.auth.uid) };
});

exports.getAdminDashboard = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to access the administrator dashboard.');
  }
  if (!(await isConfiguredAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }

  const pageToken = request.data?.pageToken;
  const email = request.data?.email;
  if (pageToken !== undefined && pageToken !== null && typeof pageToken !== 'string') {
    throw new HttpsError('invalid-argument', 'The account page token is invalid.');
  }
  if (email !== undefined && typeof email !== 'string') {
    throw new HttpsError('invalid-argument', 'The account email must be text.');
  }

  const toAdminAccount = (account) => ({
    uid: account.uid,
    email: account.email || null,
    displayName: account.displayName || null,
    emailVerified: account.emailVerified,
    disabled: account.disabled,
    premium: account.customClaims?.premium === true,
    createdAt: account.metadata.creationTime,
    lastSignInAt: account.metadata.lastSignInTime || null,
  });

  if (email?.trim()) {
    if (!email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Enter a valid account email.');
    }
    try {
      const account = await getAuth().getUserByEmail(email.trim());
      return { users: [toAdminAccount(account)], nextPageToken: null };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return { users: [], nextPageToken: null };
      }
      throw error;
    }
  }

  const result = await getAuth().listUsers(50, pageToken || undefined);
  const users = result.users.map(toAdminAccount);

  return {
    users,
    nextPageToken: result.pageToken || null,
  };
});

exports.setPremiumAccess = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to manage Premium access.');
  }

  if (!(await isConfiguredAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Only configured Premium admins can grant access.');
  }

  const { email, enabled } = request.data || {};
  if (typeof email !== 'string' || typeof enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Provide a target email and Premium status.');
  }

  const target = await getAuth().getUserByEmail(email.trim());
  await getAuth().setCustomUserClaims(target.uid, {
    ...target.customClaims,
    premium: enabled,
  });
  if (!enabled) {
    const devices = await db.collection(`users/${target.uid}/devices`).get();
    await Promise.all(devices.docs.map((device) => device.ref.delete()));
  }
  return { uid: target.uid, premium: enabled };
});
