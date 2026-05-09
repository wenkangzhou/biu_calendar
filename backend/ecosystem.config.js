module.exports = {
  apps: [{
    name: 'biu-calendar-api',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    interpreter: '/root/.nvm/nvm-0.38.0/versions/node/v14.21.3/bin/node',
    env: {
      NODE_ENV: 'production'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
