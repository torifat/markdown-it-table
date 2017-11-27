const path = require('path');

module.exports = {
  entry: './src',
  output: {
    path: path.resolve('./dist'),
    filename: 'markdown-it-table.js',
    libraryTarget: 'commonjs2',
    libraryExport: 'default',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
};
