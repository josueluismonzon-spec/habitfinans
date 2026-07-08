const nodemailer = require('nodemailer');
require('dotenv').config();

// Configurar transporte de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Enviar resumen diario por email
 */
async function sendDailyEmail(userEmail, insight) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'HabitFinans <noreply@habitfinans.app>',
      to: userEmail,
      subject: '📊 Tu resumen diario de HabitFinans',
      html: generarHTMLEmail(insight, 'diario')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email diario enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
}

/**
 * Enviar resumen semanal
 */
async function sendWeeklyEmail(userEmail, insight) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'HabitFinans <noreply@habitfinans.app>',
      to: userEmail,
      subject: '📈 Tu resumen semanal de HabitFinans',
      html: generarHTMLEmail(insight, 'semanal')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email semanal enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email semanal:', error);
    return false;
  }
}

/**
 * Generar HTML del email
 */
function generarHTMLEmail(insight, tipo) {
  const isemanal = tipo === 'semanal';
  const titulo = isemanal ? 'Resumen Semanal' : 'Resumen Diario';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #0A0E27 0%, #1A1F3A 100%);
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #1A1F3A;
      border: 2px solid #00D9FF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 217, 255, 0.2);
    }
    .header {
      background: linear-gradient(135deg, #00D9FF 0%, #FF006E 100%);
      color: #000;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
    }
    .header p {
      margin: 8px 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
      color: #E8F2EE;
    }
    .insight {
      background: #2D3561;
      border-left: 4px solid #00D9FF;
      padding: 16px;
      margin: 16px 0;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .cta {
      text-align: center;
      margin: 24px 0;
    }
    .cta a {
      background: linear-gradient(135deg, #00D9FF, #FFBE0B);
      color: #000;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      display: inline-block;
    }
    .footer {
      background: #151f2a;
      color: #7B8E84;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      border-top: 1px solid #2D3561;
    }
    .footer a {
      color: #00D9FF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 HabitFinans</h1>
      <p>${titulo}</p>
    </div>
    <div class="content">
      <p>¡Hola! Aquí está tu ${titulo.toLowerCase()} de HabitFinans:</p>
      <div class="insight">${insight}</div>
      <div class="cta">
        <a href="https://habitfinans.app">Ver tu dashboard completo →</a>
      </div>
      <p style="margin-top: 24px; font-size: 13px; color: #A5B0D0;">
        Recuerda: El 1% de mejora cada día suma a lo largo del tiempo. ¡Sigue adelante! 💚
      </p>
    </div>
    <div class="footer">
      <p>© 2026 HabitFinans - Tu compañero de finanzas y hábitos</p>
      <p>
        <a href="https://habitfinans.app">Sitio web</a> |
        <a href="mailto:support@habitfinans.app">Soporte</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Verificar configuración de email
 */
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('✅ Configuración de email verificada correctamente');
    return true;
  } catch (error) {
    console.warn('⚠️ Email no configurado:', error.message);
    console.warn('💡 Para activar emails, configura EMAIL_USER y EMAIL_PASSWORD en .env');
    return false;
  }
}

module.exports = {
  sendDailyEmail,
  sendWeeklyEmail,
  verifyEmailConfig
};
