import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'unicorn/prefer-node-protocol': 'off',
    'node/prefer-global': 'off',
    'node/prefer-global/buffer': 'off',
    'no-restricted-globals': 'off',
  },
}, {
  files: ['**/*.vue'],
  rules: {
    // A single-file component with both `<script>` and `<script setup>` is not
    // one module. `import/first` reads it as one, so its autofix hoists the
    // setup imports above the module block and drags the module block's exports
    // into `<script setup>`, where Vue cannot compile them.
    'import/first': 'off',
  },
}, {
  files: ['pnpm-workspace.yaml'],
  rules: {
    // Nuxt tools retain TypeScript 6 alongside the native TypeScript 7 checker.
    'pnpm/yaml-no-duplicate-catalog-item': ['error', { checkDuplicates: 'exact-version' }],
  },
})
