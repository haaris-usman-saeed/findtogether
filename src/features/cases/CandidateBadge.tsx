import { CircleCheck, Clock, ShieldCheck, ShieldOff, Users, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import type { CandidateState } from '../../domain/types';

export function CandidateBadge({ state }: { state: CandidateState }) {
  switch (state) {
    case 'possible':
      return <Badge tone="accent" icon={Users}>Possible match</Badge>;
    case 'verifying':
      return <Badge tone="accent" icon={Clock}>Verifying</Badge>;
    case 'authorized':
      return <Badge tone="success" icon={ShieldCheck}>Contact authorized</Badge>;
    case 'reconnected':
      return <Badge tone="success" icon={CircleCheck}>Contact made</Badge>;
    case 'ruled_out':
      return <Badge tone="neutral" icon={X}>Ruled out</Badge>;
    case 'declined':
      return <Badge tone="guarded" icon={ShieldOff}>Declined contact</Badge>;
  }
}
