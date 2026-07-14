const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const commands = [
    {
        name: 'join',
        description: 'Bot joins your voice channel',
        options: [
            {
                name: 'channel',
                description: 'Voice channel name or ID',
                type: 3, // STRING type
                required: false
            }
        ]
    },
    {
        name: 'play',
        description: 'Play audio in voice channel (only works if bot is already in voice)'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();