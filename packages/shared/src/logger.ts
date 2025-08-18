import chalk from 'chalk';

export class Logger {
	constructor(
		private verbose: boolean = false,
		private quiet: boolean = false,
		private jsonMode: boolean = false
	) {}

	info(message: string, data?: any): void {
		if (this.quiet || this.jsonMode) return;
		console.log(chalk.blue('ℹ'), message);
		if (data && this.verbose) console.log(data);
	}

	success(message: string): void {
		if (this.quiet || this.jsonMode) return;
		console.log(chalk.green('✔'), message);
	}

	error(message: string, error?: Error): void {
		if (this.jsonMode) {
			console.log(JSON.stringify({ error: message, details: error?.message }));
		} else {
			console.error(chalk.red('✖'), message);
			if (error && this.verbose) console.error(error);
		}
	}

	warn(message: string): void {
		if (this.quiet || this.jsonMode) return;
		console.log(chalk.yellow('⚠'), message);
	}

	json(data: any): void {
		if (this.jsonMode) {
			console.log(JSON.stringify(data, null, 2));
		}
	}
}
