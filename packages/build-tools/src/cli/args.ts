export function readArg(args: string[], name: string): string | undefined {
	const index = args.indexOf(name)
	if (index === -1) return undefined
	return args[index + 1]
}

export function hasArg(args: string[], name: string): boolean {
	return args.includes(name)
}
