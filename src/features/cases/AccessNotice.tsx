import { Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Notice } from '../../components/ui/Notice';

export function AccessNotice() {
  return (
    <div className="max-w-form space-y-4">
      <Notice tone="guarded" icon={Lock} title="Only reunification coordinators can review cases">
        <p>
          Ask your shelter lead if you need access. To answer someone asking about their search, use{' '}
          <Link to="/status" className="font-medium text-accent underline underline-offset-4">
            Check a request
          </Link>
          .
        </p>
      </Notice>
      <Notice tone="demo">
        <p>
          The mock backend refused this request because the simulated role is volunteer. Switch roles in Reviewer tools.
          In production the server has to enforce this. Hiding a page in the browser is not protection.
        </p>
      </Notice>
    </div>
  );
}
