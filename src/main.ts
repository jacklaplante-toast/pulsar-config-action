import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get GitHub context and token
    const token = process.env.GITHUB_TOKEN || core.getInput('github_token')
    if (!token) {
      throw new Error('GitHub token not found. Set GITHUB_TOKEN env or pass as input.')
    }
    const octokit = github.getOctokit(token)
    const context = github.context

    // Only run on PRs
    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping catalog-info.yml check.')
      return
    }

    const owner = context.repo.owner
    const repo = context.repo.repo
    const pull_number = context.payload.pull_request.number
    const base_sha = context.payload.pull_request.base.sha
    const head_sha = context.payload.pull_request.head.sha

    // Get list of changed files in the PR
    const files = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number
    })
    const changed = files.data.some(f => f.filename === '.toast/catalog-info.yml')
    if (!changed) {
      core.info('No changes to .toast/catalog-info.yml in this PR.')
      return
    }
    core.info('.toast/catalog-info.yml was changed in this PR.')

    // Fetch file contents from base and head
    const getFile = async (ref: string) => {
      try {
        const res = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: '.toast/catalog-info.yml',
          ref
        })
        // File content is base64 encoded
        if (!('content' in res.data)) throw new Error('File content not found')
        return Buffer.from(res.data.content, 'base64').toString('utf8')
      } catch (e) {
        core.warning(`Could not fetch .toast/catalog-info.yml at ref ${ref}: ${e}`)
        return ''
      }
    }
    const baseContent = await getFile(base_sha)
    const headContent = await getFile(head_sha)

    // Log or set outputs for later use
    core.setOutput('catalog_info_base', baseContent)
    core.setOutput('catalog_info_head', headContent)
    core.info('Fetched .toast/catalog-info.yml from both base and head branches.')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
