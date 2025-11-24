import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['out', 'dist', '**/*.d.ts'],
	},
	...tseslint.configs.recommended,
	{
		rules: {
			'curly': 'warn',
			'eqeqeq': 'warn',
			'no-throw-literal': 'warn',
		},
	}
);
