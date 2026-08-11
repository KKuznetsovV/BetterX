// Must load before any model uses DataTypes.VECTOR (ES import order is not
// enough for inline require).
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('pgvector/sequelize')
