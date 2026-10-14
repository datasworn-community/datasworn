export interface PullRequestReleaseLabels {
	number: number
	/** The pull request's release labels, already narrowed to the known ones. */
	labels: readonly string[]
}

// Strongest first: a release is as large as the largest change it ships.
const precedence = [
	'release:major-schema',
	'release:minor-schema',
	'release:patch',
	'release:none'
]

/**
 * The release labels one release from main acts on, given the pull requests
 * merged since the last release.
 *
 * Usually that is one pull request, and its labels come back unchanged, so a
 * release plans exactly as it would from that pull request alone. Several
 * pull requests ship together when a release run stopped because main moved
 * on before it could push: the next run then releases them all, and the
 * strongest label wins. A pull request without a release label would have
 * shipped as an automatic patch on its own, so it counts as `release:patch`,
 * and `release:none` holds only when every pull request asked for it.
 */
export function combineReleaseLabels(
	pullRequests: readonly PullRequestReleaseLabels[]
): string[] {
	if (pullRequests.length <= 1) return [...(pullRequests[0]?.labels ?? [])]

	const wanted = pullRequests.map(({ number, labels }) => {
		if (labels.length > 1)
			throw new Error(
				`Release intent of #${number} is ambiguous; use at most one release label, found ${labels.join(', ')}`
			)
		return labels[0] ?? 'release:patch'
	})

	const strongest = precedence.find((label) => wanted.includes(label))
	return strongest ? [strongest] : []
}
