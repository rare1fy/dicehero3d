// Batch sim runner: npx vite-node src/core/v2/simcli.ts 200 [cls=rogue] [stage=built] [sleeve=first2] [refund=1] [v3] [extra]
import { runCli } from './sim';

const g = globalThis as unknown as { process?: { argv: string[] } };
runCli((g.process?.argv || []).slice(2));
