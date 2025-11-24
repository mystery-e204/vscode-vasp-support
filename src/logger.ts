import * as vscode from 'vscode';

class Logger {
	private outputChannel: vscode.OutputChannel | null = null;

	initialize(name: string): void {
		this.outputChannel = vscode.window.createOutputChannel(name);
	}

	info(message: string): void {
		this.log('INFO', message);
	}

	warn(message: string): void {
		this.log('WARN', message);
	}

	error(message: string, error?: unknown): void {
		const errorMessage = error instanceof Error ? `: ${error.message}` : '';
		this.log('ERROR', `${message}${errorMessage}`);
		if (error instanceof Error && error.stack) {
			this.log('ERROR', error.stack);
		}
	}

	private log(level: string, message: string): void {
		if (!this.outputChannel) {
			console.error('Logger not initialized');
			return;
		}
		const timestamp = new Date().toISOString();
		this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
	}

	dispose(): void {
		this.outputChannel?.dispose();
	}
}

export const logger = new Logger();
