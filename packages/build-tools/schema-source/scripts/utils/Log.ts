/**
 * Minimal console-based logger, standing in for upstream's winston/logform
 * setup so generation doesn't pull in a logging framework.
 */
const Log = {
	// `log` (rather than `info`) matches ajv's `Logger` interface, which this
	// object is passed to directly.
	log: (...args: unknown[]) => console.info(...args),
	info: (...args: unknown[]) => console.info(...args),
	warn: (...args: unknown[]) => console.warn(...args),
	error: (...args: unknown[]) => console.error(...args),
	verbose: (...args: unknown[]) => console.debug(...args)
}

export default Log
