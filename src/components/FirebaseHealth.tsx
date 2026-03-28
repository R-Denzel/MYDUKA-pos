import { useEffect, useState } from 'react';
import { testFirebaseHealth } from '@/lib/firebase';

export default function FirebaseHealth() {
  const [status, setStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown');

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const healthy = await testFirebaseHealth();
        if (!active) return;
        setStatus(healthy ? 'ok' : 'fail');
      } catch {
        if (!active) return;
        setStatus('fail');
      }
    };

    check();

    return () => {
      active = false;
    };
  }, []);

  const label =
    status === 'unknown'
      ? 'Checking Firebase…'
      : status === 'ok'
      ? 'Firebase: Connected'
      : 'Firebase: Disconnected';

  const color =
    status === 'ok' ? 'text-success' : status === 'fail' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className={`inline-flex items-center gap-2 p-2 rounded-lg bg-card border border-border ${color}`}>
      <span className="text-meta">{label}</span>
    </div>
  );
}
