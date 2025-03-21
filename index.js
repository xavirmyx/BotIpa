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

// Comando /menu
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== CHAT_ID) {
    bot.sendMessage(chatId, 'Este bot solo funciona en el grupo autorizado.');
    return;
  }
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
  if (chatId.toString() !== CHAT_ID) {
    bot.sendMessage(chatId, 'Este bot solo funciona en el grupo autorizado.');
    return;
  }

  const url = match[1];
  const appIdMatch = url.match(/id(\d+)/);
  if (!appIdMatch) {
    bot.sendMessage(chatId, 'Enlace inválido. Usa un enlace de la App Store (ej. https://apps.apple.com/app/id123456789).');
    return;
  }
  const appId = appIdMatch[1];

  bot.sendMessage(chatId, 'Descargando el .ipa, espera un momento...');

  // Descargar el .ipa usando ipatool
  exec(`./ipatool download -i ${appId} --email "${APPLE_ID}" --password "${APPLE_PASSWORD}" -o ${appId}.ipa`, (error, stdout, stderr) => {
    if (error) {
      bot.sendMessage(chatId, `Error: ${stderr}`);
      return;
    }

    // Enviar el archivo al usuario
    const filePath = path.join(__dirname, `${appId}.ipa`);
    if (fs.existsSync(filePath)) {
      bot.sendDocument(chatId, filePath, {}, { filename: `${appId}.ipa` })
        .then(() => {
          // Limpiar el archivo después de enviarlo
          fs.unlinkSync(filePath);
          bot.sendMessage(chatId, '¡Listo! Aquí tienes tu .ipa.');
        })
        .catch((err) => {
          bot.sendMessage(chatId, `Error al enviar el archivo: ${err.message}`);
        });
    } else {
      bot.sendMessage(chatId, 'Error: No se pudo generar el archivo .ipa.');
    }
  });
});

// Configurar el webhook
app.post(`/${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Ruta raíz para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Iniciar el servidor
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  const host = process.env.REPLIT_APP_URL || process.env.RENDER_EXTERNAL_HOSTNAME || 'your-app-name.repl.co';
  const webhookUrl = `https://${host}/${TOKEN}`;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=${webhookUrl}`);
    console.log(`Webhook configurado en: ${webhookUrl}`, response.data);
  } catch (err) {
    console.error(`Error al configurar el webhook: ${JSON.stringify(err.response ? err.response.data : err.message, null, 2)}`);
  }
});