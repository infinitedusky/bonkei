// The docs run's result as a table on its GitHub Actions run page (BON-217): it runs nightly, not on a pull request, so nobody reads
// its log unless the run page says what failed. GitHub sets GITHUB_STEP_SUMMARY in a job; anywhere else nothing is written.
import fs from 'node:fs'

// results: [{ name, ok }] in the order the steps ran
export function summaryOf(results) {
  const failed = results.filter(r => !r.ok).length
  return [
    '## The docs run (`pnpm docs:smoke`)',
    '',
    '| Step | Result |',
    '| --- | --- |',
    ...results.map(r => `| ${r.name.replaceAll('|', '\\|')} | ${r.ok ? 'ok' : '**FAILED**'} |`),
    '',
    failed ? `${failed} of ${results.length} step(s) failed: the job's log has each step's output under \`== docs smoke: <step>\`.` : `All ${results.length} steps ok.`,
    '',
  ].join('\n')
}

export function writeSummary(results, file = process.env.GITHUB_STEP_SUMMARY) {
  if (file) fs.appendFileSync(file, summaryOf(results))
}
