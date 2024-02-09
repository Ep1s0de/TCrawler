module.exports = {
  apps: [
    {
      name: 't-crawler',
      script: './main.js',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3001'
      }
    }
  ]
};
