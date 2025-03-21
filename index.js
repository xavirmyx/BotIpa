const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración desde variables de entorno
const TOKEN = process.env.TELEGRAM_TOKEN || '7617442460:AAEN7vhRrbVd3pIlARM6jVG6L6OR5aKkJEw';
const CHAT_ID = '-1002565012502';
const APPLE_ID = process.env.APPLE_ID;
const APPLE_PASSWORD = process.env.APPLE_PASSWORD;
const PORT = process.env.PORT || 8443;

// Crear el bot y el servidor Express
const bot = new TelegramBot(TOKEN);
const app = express();
app.use(express.json());

// Middleware para loguear todas las solicitudes entrantes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Solicitud recibida: ${req.method} ${req.url}`);
  console.log('Cuerpo de la solicitud:', JSON.stringify(req.body, null, 2));
  next();
});

// Ruta raíz para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  console.log(`[${new Date().toISOString()}] Solicitud GET a la raíz recibida`);
  res.send('Bot is running!');
});

// Configurar el webhook
app.post(`/${TOKEN}`, (req, res) => {
  console.log(`[${new Date().toISOString()}] Webhook activado. Actualización recibida:`, JSON.stringify(req.body, null, 2));
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Comando /menu
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`[${new Date().toISOString()}] Comando /menu recibido. Chat ID: ${chatId}`);
  if (chatId.toString() !== CHAT_ID) {
    console.log(`[${new Date().toISOString()}] Chat ID no autorizado: ${chatId}`);
    bot.sendMessage(chatId, 'Este bot solo funciona en el grupo autorizado.');
    return;
  }
  console.log(`[${new Date().toISOString()}] Enviando menú al chat ID: ${chatId}`);
  bot.sendMessage(chatId, 
    'Comandos disponibles:\n' +
    '/menu - Muestra este menú\n' +
    '/ipa <enlace> - Descarga el .ipa desde un enlace de la App Store\n' +
    'Ejemplo: /ipa https://apps.apple.com/app/id123456789'
  );
});

// Comando /ipa
bot.onText(/\/ipa (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  console.log(`[${new Date().toISOString()}] Comando /ipa recibido. Chat ID: ${chatId}, Enlace: ${match[1]}`);
  if (chatId.toString() !== CHAT_ID) {
    console.log(`[${new Date().toISOString()}] Chat ID no autorizado: ${chatId}`);
    bot.sendMessage(chatId, 'Este bot solo funciona en el grupo autorizado.');
    return;
  }

  const url = match[1];
  const appIdMatch = url.match(/id(\d+)/);
  if (!appIdMatch) {
    console.log(`[${new Date().toISOString()}] Enlace inválido: ${url}`);
    bot.sendMessage(chatId, 'Enlace inválido. Usa un enlace de la App Store (ej. https://apps.apple.com/app/id123456789).');
    return;
  }
  const appId = appIdMatch[1];
  console.log(`[${new Date().toISOString()}] App ID extraído: ${appId}`);

  bot.sendMessage(chatId, 'Descargando el .ipa, espera un momento...');

  // Descargar el .ipa usando ipatool
  console.log(`[${new Date().toISOString()}] Ejecutando ipatool para descargar IPA con App ID: ${appId}`);
  exec(`./ipatool download -i ${appId} --email "${APPLE_ID}" --password "${APPLE_PASSWORD}" -o ${appId}.ipa`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Error al ejecutar ipatool: ${stderr}`);
      bot.sendMessage(chatId, `Error: ${stderr}`);
      return;
    }
    console.log(`[${new Date().toISOString()}] ipatool ejecutado con éxito. Salida: ${stdout}`);

    // Enviar el archivo al usuario
    const filePath = path.join(__dirname, `${appId}.ipa`);
    if (fs.existsSync(filePath)) {
      console.log(`[${new Date().toISOString()}] Archivo IPA generado: ${filePath}`);
      bot.sendDocument(chatId, filePath, {}, { filename: `${appId}.ipa` })
        .then(() => {
          console.log(`[${new Date().toISOString()}] Archivo IPA enviado al chat ID: ${chatId}`);
          // Limpiar el archivo después de enviarlo
          fs.unlinkSync(filePath);
          bot.sendMessage(chatId, '¡Listo! Aquí tienes tu .ipa.');
        })
        .catch((err) => {
          console.error(`[${new Date().toISOString()}] Error al enviar el archivo: ${err.message}`);
          bot.sendMessage(chatId, `Error al enviar el archivo: ${err.message}`);
        });
    } else {
      console.error(`[${new Date().toISOString()}] Error: No se pudo generar el archivo IPA en ${filePath}`);
      bot.sendMessage(chatId, 'Error: No se pudo generar el archivo .ipa.');
    }
  });
});

// Iniciar el servidor
app.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] Servidor corriendo en el puerto ${PORT}`);
  const host = process.env.RENDER_EXTERNAL_HOSTNAME || 'botipa.onrender.com';
  const webhookUrl = `https://${host}/${TOKEN}`;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=${webhookUrl}`);
    console.log(`[${new Date().toISOString()}] Webhook configurado en: ${webhookUrl}`, response.data);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error al configurar el webhook: ${JSON.stringify(err.response ? err.response.data : err.message, null, 2)}`);
  }
});