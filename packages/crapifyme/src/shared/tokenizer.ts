export interface Token {
	type: 'comment' | 'string' | 'code' | 'console-log';
	value: string;
	startPos: number;
	endPos: number;
}

export class SimpleTokenizer {
	private content: string = '';
	private position: number = 0;

	tokenize(content: string): Token[] {
		this.content = content;
		this.position = 0;
		const tokens: Token[] = [];

		while (this.position < this.content.length) {
			const token = this.nextToken();
			if (token) {
				tokens.push(token);
			}
		}

		return tokens;
	}

	private nextToken(): Token | null {
		if (this.position >= this.content.length) {
			return null;
		}

		const startPos = this.position;
		const char = this.content[this.position];
		const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

		if (char === '"' || char === "'" || char === '`') {
			return this.parseString(startPos, char);
		}

		if (char === '/' && next === '/') {
			return this.parseLineComment(startPos);
		}

		if (char === '/' && next === '*') {
			return this.parseBlockComment(startPos);
		}

		if (char === '<' && this.content.substring(this.position, this.position + 4) === '<!--') {
			return this.parseHtmlComment(startPos);
		}

		if (this.isConsoleLogStart()) {
			return this.parseConsoleLog(startPos);
		}

		return this.parseCode(startPos);
	}

	private parseString(startPos: number, quote: string): Token {
		let value = '';

		value += this.content[this.position];
		this.position++;

		while (this.position < this.content.length) {
			const char = this.content[this.position];

			if (char === '\\') {
				value += char;
				this.position++;
				if (this.position < this.content.length) {
					value += this.content[this.position];
					this.position++;
				}
			} else if (char === quote) {
				value += char;
				this.position++;
				break;
			} else if (char === '\n' && quote !== '`') {
				break;
			} else {
				value += char;
				this.position++;
			}
		}

		return {
			type: 'string',
			value,
			startPos,
			endPos: this.position
		};
	}

	private parseLineComment(startPos: number): Token {
		let value = '';

		while (this.position < this.content.length && this.content[this.position] !== '\n') {
			value += this.content[this.position];
			this.position++;
		}

		return {
			type: 'comment',
			value,
			startPos,
			endPos: this.position
		};
	}

	private parseBlockComment(startPos: number): Token {
		let value = '';

		value += this.content[this.position] + this.content[this.position + 1];
		this.position += 2;

		while (this.position < this.content.length - 1) {
			if (this.content[this.position] === '*' && this.content[this.position + 1] === '/') {
				value += '*/';
				this.position += 2;
				break;
			}
			value += this.content[this.position];
			this.position++;
		}

		return {
			type: 'comment',
			value,
			startPos,
			endPos: this.position
		};
	}

	private parseHtmlComment(startPos: number): Token {
		let value = '';

		value += this.content.substring(this.position, this.position + 4);
		this.position += 4;

		while (this.position < this.content.length - 2) {
			if (this.content.substring(this.position, this.position + 3) === '-->') {
				value += '-->';
				this.position += 3;
				break;
			}
			value += this.content[this.position];
			this.position++;
		}

		return {
			type: 'comment',
			value,
			startPos,
			endPos: this.position
		};
	}

	private isConsoleLogStart(): boolean {
		const remaining = this.content.substring(this.position);
		return /^console\s*\.\s*(log|error|warn|debug|info|assert|trace|time|timeEnd)\s*\(/.test(
			remaining
		);
	}

	private parseConsoleLog(startPos: number): Token {
		let value = '';
		let parenCount = 0;
		let foundOpenParen = false;

		while (this.position < this.content.length) {
			const char = this.content[this.position];
			value += char;

			if (char === '(') {
				parenCount++;
				foundOpenParen = true;
			} else if (char === ')') {
				parenCount--;
				if (foundOpenParen && parenCount === 0) {
					this.position++;

					if (this.position < this.content.length && this.content[this.position] === ';') {
						value += ';';
						this.position++;
					}
					break;
				}
			} else if (char === '"' || char === "'" || char === '`') {
				const quote = char;
				this.position++;
				while (this.position < this.content.length) {
					const innerChar = this.content[this.position];
					value += innerChar;
					if (innerChar === '\\') {
						this.position++;
						if (this.position < this.content.length) {
							value += this.content[this.position];
						}
					} else if (innerChar === quote) {
						this.position++;
						break;
					}
					this.position++;
				}
				continue;
			}

			this.position++;
		}

		return {
			type: 'console-log',
			value,
			startPos,
			endPos: this.position
		};
	}

	private parseCode(startPos: number): Token {
		let value = '';

		while (this.position < this.content.length) {
			const char = this.content[this.position];

			if (
				char === '"' ||
				char === "'" ||
				char === '`' ||
				(char === '/' &&
					this.position + 1 < this.content.length &&
					(this.content[this.position + 1] === '/' || this.content[this.position + 1] === '*')) ||
				(char === '<' && this.content.substring(this.position, this.position + 4) === '<!--') ||
				this.isConsoleLogStart()
			) {
				break;
			}

			value += char;
			this.position++;

			if (/\s/.test(char)) {
				break;
			}
		}

		if (value === '' && this.position < this.content.length) {
			value = this.content[this.position];
			this.position++;
		}

		return {
			type: 'code',
			value,
			startPos,
			endPos: this.position
		};
	}
}
