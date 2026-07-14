const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const dotenv = require('dotenv');
const ytdl = require('@distube/ytdl-core');

dotenv.config();

// Initialize client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// Store voice connections and players
const voiceConnections = new Map();
const audioPlayers = new Map();

// Function to get voice channel by name or ID
async function getVoiceChannel(guild, query) {
    // Try to find by ID first
    let channel = guild.channels.cache.get(query);
    
    // If not found, try to find by name (case insensitive)
    if (!channel) {
        channel = guild.channels.cache.find(
            ch => ch.type === 2 && ch.name.toLowerCase() === query.toLowerCase()
        );
    }
    
    return channel;
}

// Join voice channel function
async function joinVoiceChannelHandler(interaction, channelQuery = null) {
    const guild = interaction.guild;
    const member = interaction.member;
    
    // Get the voice channel
    let voiceChannel;
    
    if (channelQuery) {
        // Custom channel specified
        voiceChannel = await getVoiceChannel(guild, channelQuery);
        if (!voiceChannel) {
            await interaction.reply(`❌ Voice channel "${channelQuery}" not found!`);
            return false;
        }
    } else {
        // Use member's current voice channel
        voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply('❌ You need to be in a voice channel first! Or specify a channel name/ID.');
            return false;
        }
    }

    try {
        // Check if already connected to this channel
        const existingConnection = voiceConnections.get(guild.id);
        if (existingConnection && existingConnection.joinConfig.channelId === voiceChannel.id) {
            await interaction.reply(`✅ Already connected to **${voiceChannel.name}**!`);
            return true;
        }

        // Leave existing connection if exists
        if (existingConnection) {
            existingConnection.destroy();
            voiceConnections.delete(guild.id);
            audioPlayers.delete(guild.id);
        }

        // Join the voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        // Store connection
        voiceConnections.set(guild.id, connection);

        // Create audio player
        const player = createAudioPlayer();
        audioPlayers.set(guild.id, player);
        
        // Subscribe player to connection
        connection.subscribe(player);

        // Handle player errors
        player.on('error', error => {
            console.error('Player error:', error);
        });

        // Handle connection errors
        connection.on('error', error => {
            console.error('Connection error:', error);
        });

        await interaction.reply(`✅ Joined **${voiceChannel.name}**! Use /play to play audio.`);
        return true;
    } catch (error) {
        console.error('Error joining voice channel:', error);
        await interaction.reply(`❌ Failed to join voice channel: ${error.message}`);
        return false;
    }
}

// Play audio function
async function playAudio(interaction) {
    const guild = interaction.guild;
    const connection = voiceConnections.get(guild.id);
    const player = audioPlayers.get(guild.id);
    
    if (!connection || !player) {
        await interaction.reply('❌ Bot is not in a voice channel! Use /join first.');
        return;
    }

    try {
        // Check if already playing
        if (player.state.status === AudioPlayerStatus.Playing) {
            await interaction.reply('🎵 Already playing audio!');
            return;
        }

        // Create a simple audio resource (you can replace this with any audio URL)
        // Using a public audio file as example
        const audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        
        // Create audio resource
        const resource = createAudioResource(audioUrl, {
            inlineVolume: true
        });
        
        // Set volume (0-1)
        resource.volume?.setVolume(0.5);

        // Play the audio
        player.play(resource);

        await interaction.reply('▶️ Now playing audio!');
    } catch (error) {
        console.error('Error playing audio:', error);
        await interaction.reply(`❌ Failed to play audio: ${error.message}`);
    }
}

// Bot ready event
client.once(Events.ClientReady, () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
});

// Slash command handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'join': {
                const channelQuery = interaction.options.getString('channel');
                await joinVoiceChannelHandler(interaction, channelQuery);
                break;
            }
            
            case 'play': {
                await playAudio(interaction);
                break;
            }
            
            default:
                await interaction.reply('❌ Unknown command!');
        }
    } catch (error) {
        console.error('Command error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(`❌ Error: ${error.message}`);
        }
    }
});

// Handle disconnections
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    // If bot leaves a voice channel
    if (oldState.member.id === client.user.id && !newState.channelId) {
        const guildId = oldState.guild.id;
        voiceConnections.delete(guildId);
        audioPlayers.delete(guildId);
        console.log('Bot disconnected from voice channel');
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    for (const connection of voiceConnections.values()) {
        connection.destroy();
    }
    client.destroy();
    process.exit(0);
});