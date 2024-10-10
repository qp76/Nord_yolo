const { IgApiClient } = require('instagram-private-api');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// Variables for Instagram and Discord
const IG_USERNAME = 'your_instagram_username';
const IG_PASSWORD = 'your_instagram_password';
const TARGET_USERNAME = 'target_user';  // Username to fetch media from
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID';

// Initialize Instagram API Client
const ig = new IgApiClient();

async function loginToInstagram() {
  try {
    // Basic login setup
    ig.state.generateDevice(IG_USERNAME);

    // Check if saved session exists
    if (fs.existsSync('./session.json')) {
      console.log('Loading saved session...');
      const savedSession = JSON.parse(fs.readFileSync('./session.json', 'utf-8'));
      await ig.state.deserializeCookieJar(savedSession);
    } else {
      console.log('Logging in to Instagram...');
      await ig.account.login(IG_USERNAME, IG_PASSWORD);
      console.log('Logged in successfully.');

      // Save session for future use
      const cookieJar = await ig.state.serializeCookieJar();
      fs.writeFileSync('./session.json', JSON.stringify(cookieJar));
    }
  } catch (error) {
    console.error('Instagram login failed:', error.message);
    if (error.message.includes('challenge_required')) {
      console.log('Challenge required. Please manually solve it via Instagram.');
    }
    throw error;
  }
}

// Fetch media from target Instagram user
async function fetchUserMedia() {
  try {
    const userId = await ig.user.getIdByUsername(TARGET_USERNAME);
    const userFeed = ig.feed.user(userId);
    const posts = await userFeed.items();

    const mediaUrls = posts.map(post => {
      if (post.image_versions2) {
        return post.image_versions2.candidates[0].url;
      } else if (post.video_versions) {
        return post.video_versions[0].url;
      }
      return null;
    }).filter(url => url !== null);

    console.log(`Fetched media URLs:`, mediaUrls);
    return mediaUrls;

  } catch (error) {
    console.error('Failed to fetch user media:', error);
    throw error;
  }
}

// Send media to Discord webhook
async function sendMediaToDiscord(mediaUrls) {
  for (const mediaUrl of mediaUrls) {
    try {
      const formData = new FormData();
      formData.append('content', `Media from Instagram: ${mediaUrl}`);

      await axios.post(DISCORD_WEBHOOK_URL, formData, {
        headers: formData.getHeaders(),
      });

      console.log(`Media sent to Discord: ${mediaUrl}`);
      await delay(2000); // Add delay to avoid rate limits

    } catch (error) {
      console.error('Failed to send media to Discord:', error);
    }
  }
}

// Main function to run the bot
(async () => {
  try {
    await loginToInstagram();
    const mediaUrls = await fetchUserMedia();

    if (mediaUrls.length > 0) {
      await sendMediaToDiscord(mediaUrls);
    } else {
      console.log('No media found.');
    }
  } catch (error) {
    console.error('Failed to run Instagram bot:', error);
  }
})();

// Helper function to delay actions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
