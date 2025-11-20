const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    popup: './src/popup/index.tsx',
    content: './src/content/content.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            // Update paths for built files
            manifest.background.service_worker = 'background.js';
            manifest.action.default_popup = 'popup.html';
            return JSON.stringify(manifest, null, 2);
          }
        },
        { from: 'rules.json', to: 'rules.json' },
        { from: 'icon*.png', to: '[name][ext]' },
      ],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks(chunk) {
        // Don't split the background bundle
        return chunk.name !== 'background';
      },
    },
  },
};
