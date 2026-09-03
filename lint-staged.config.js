const formatFiles = "prettier --ignore-unknown --write";
const lintFiles = "eslint --cache --fix --quiet";
const sortPackageJson = "better-sort-package-json";

export default {
  "!(*.{js,json,md,ts,tsx,yml}|package.json)": [formatFiles],
  "*.{js,md,ts,tsx}": [lintFiles, formatFiles],
  "*.yml": [formatFiles],
  "package.json": [sortPackageJson, formatFiles],
};
