#!/usr/bin/env node

const { User, Band, Song, BandMember, BandInvitation, Setlist, SetlistSet, BandSong } = require('./models');
const readline = require('readline');

// Environment variables for server connection
const HOST_USER = process.env.HOST_USER || 'bagus1';
const HOST_DOMAIN = process.env.HOST_DOMAIN || 'bagus.org';
const SETLIST_PATH = process.env.SETLIST_PATH || '/home/bagus1/repositories/setlister';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Check if colors are supported
const supportsColor = process.stdout.isTTY && process.env.TERM !== 'dumb';

function log(message, color = 'reset') {
    if (supportsColor && colors[color]) {
        console.log(`${colors[color]}${message}${colors.reset}`);
    } else {
        console.log(message);
    }
}

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function confirmAction(action) {
    const answer = await question(`Are you sure you want to ${action}? (yes/no): `);
    return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
}

async function showServerInstructions() {
    log('\n🎵 Setlist Manager - Database Management Tool', 'cyan');
    log('==============================================', 'cyan');
    log('\n📡 Server Database Access', 'blue');
    log('========================', 'blue');
    log(`Server: ${HOST_USER}@${HOST_DOMAIN}`, 'blue');
    log(`Path: ${SETLIST_PATH}`, 'blue');
    log('\nTo manage the server database, use one of these commands:', 'yellow');
    log('1. Interactive mode: ssh bagus1@bagus.org "/home/bagus1/repositories/setlister/manage-server.sh"', 'white');
    log('2. Command line mode: npm run manage server <command>', 'white');
    log('   Examples:', 'white');
    log('   npm run manage server list-bands', 'white');
    log('   npm run manage server list-users', 'white');
    log('   npm run manage server stats', 'white');
    log('\nContinuing with local database...', 'blue');
    log('==============================================', 'cyan');
}

async function listUsers() {
    log('\n=== Users ===', 'cyan');
    const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'createdAt'],
        include: [{
            model: Band,
            through: { attributes: ['role'] },
            attributes: ['id', 'name']
        }],
        order: [['createdAt', 'DESC']]
    });

    users.forEach(user => {
        const bands = user.Bands && user.Bands.length > 0
            ? user.Bands.map(band => `${band.name}(${band.BandMember.role})`).join(', ')
            : 'No bands';

        log(`ID: ${user.id} | ${user.username} | ${user.email} | Created: ${user.createdAt.toLocaleDateString()}`, 'blue');
        log(`  Bands: ${bands}`, 'white');
    });
    log(`Total users: ${users.length}`, 'green');
}

async function listBands() {
    log('\n=== Bands ===', 'cyan');
    const bands = await Band.findAll({
        include: [{
            model: User,
            through: { attributes: ['role'] }
        }],
        order: [['createdAt', 'DESC']]
    });

    bands.forEach(band => {
        const memberCount = band.Users ? band.Users.length : 0;
        log(`ID: ${band.id} | ${band.name} | Members: ${memberCount} | Created: ${band.createdAt.toLocaleDateString()}`, 'blue');
    });
    log(`Total bands: ${bands.length}`, 'green');
}

async function listSongs() {
    log('\n=== Songs ===', 'cyan');
    const songs = await Song.findAll({
        include: ['Artists', 'Vocalist'],
        order: [['createdAt', 'DESC']]
    });

    songs.forEach(song => {
        const artist = song.Artists && song.Artists.length > 0 ? song.Artists[0].name : 'Unknown';
        log(`ID: ${song.id} | ${song.title} | ${artist} | Created: ${song.createdAt.toLocaleDateString()}`, 'blue');
    });
    log(`Total songs: ${songs.length}`, 'green');
}

async function deleteUser() {
    const userId = await question('Enter user ID to delete: ');
    const user = await User.findByPk(userId);

    if (!user) {
        log('User not found!', 'red');
        return;
    }

    log(`Found user: ${user.username} (${user.email})`, 'yellow');

    if (await confirmAction(`delete user ${user.username}`)) {
        // Delete related data first
        await BandInvitation.destroy({ where: { invitedBy: userId } });
        await BandMember.destroy({ where: { userId } });

        // Delete user
        await user.destroy();
        log(`User ${user.username} deleted successfully!`, 'green');
    } else {
        log('Deletion cancelled.', 'yellow');
    }
}

async function deleteBand() {
    const bandId = await question('Enter band ID to delete: ');
    const band = await Band.findByPk(bandId);

    if (!band) {
        log('Band not found!', 'red');
        return;
    }

    log(`Found band: ${band.name}`, 'yellow');

    if (await confirmAction(`delete band ${band.name}`)) {
        // Delete related data first
        await BandInvitation.destroy({ where: { bandId } });
        await BandMember.destroy({ where: { bandId } });
        await BandSong.destroy({ where: { bandId } });

        // Delete setlists and sets
        const setlists = await Setlist.findAll({ where: { bandId } });
        for (const setlist of setlists) {
            await SetlistSet.destroy({ where: { setlistId: setlist.id } });
        }
        await Setlist.destroy({ where: { bandId } });

        // Delete band
        await band.destroy();
        log(`Band ${band.name} deleted successfully!`, 'green');
    } else {
        log('Deletion cancelled.', 'yellow');
    }
}

async function deleteSong() {
    const songId = await question('Enter song ID to delete: ');
    const song = await Song.findByPk(songId);

    if (!song) {
        log('Song not found!', 'red');
        return;
    }

    log(`Found song: ${song.title}`, 'yellow');

    if (await confirmAction(`delete song ${song.title}`)) {
        // Delete related data first
        await BandSong.destroy({ where: { songId } });

        // Delete song
        await song.destroy();
        log(`Song ${song.title} deleted successfully!`, 'green');
    } else {
        log('Deletion cancelled.', 'yellow');
    }
}

async function cleanupOrphanedData() {
    log('\n=== Cleaning up orphaned data ===', 'cyan');

    // Clean up orphaned band invitations
    const orphanedInvitations = await BandInvitation.findAll({
        where: {
            expiresAt: { [require('sequelize').Op.lt]: new Date() }
        }
    });

    if (orphanedInvitations.length > 0) {
        log(`Found ${orphanedInvitations.length} expired invitations`, 'yellow');
        if (await confirmAction('delete expired invitations')) {
            await BandInvitation.destroy({
                where: {
                    expiresAt: { [require('sequelize').Op.lt]: new Date() }
                }
            });
            log('Expired invitations cleaned up!', 'green');
        }
    } else {
        log('No expired invitations found.', 'green');
    }
}

async function showStats() {
    log('\n=== Application Statistics ===', 'cyan');

    const userCount = await User.count();
    const bandCount = await Band.count();
    const songCount = await Song.count();
    const setlistCount = await Setlist.count();
    const invitationCount = await BandInvitation.count({
        where: {
            usedAt: null,
            expiresAt: { [require('sequelize').Op.gt]: new Date() }
        }
    });

    log(`Users: ${userCount}`, 'blue');
    log(`Bands: ${bandCount}`, 'blue');
    log(`Songs: ${songCount}`, 'blue');
    log(`Setlists: ${setlistCount}`, 'blue');
    log(`Active Invitations: ${invitationCount}`, 'blue');
}

async function showMenu() {
    log('\n🎵 Setlist Manager - Administration Tool', 'magenta');
    log('=====================================', 'magenta');
    log('1. List all users', 'blue');
    log('2. List all bands', 'blue');
    log('3. List all songs', 'blue');
    log('4. Delete user', 'red');
    log('5. Delete band', 'red');
    log('6. Delete song', 'red');
    log('7. Cleanup orphaned data', 'yellow');
    log('8. Show statistics', 'cyan');
    log('9. Exit', 'reset');
    log('=====================================', 'magenta');
}

async function main() {
    try {
        await showServerInstructions();

        // Sync database
        await require('./models').sequelize.sync();
        log('Database connected successfully!', 'green');

        while (true) {
            await showMenu();
            const choice = await question('Enter your choice (1-9): ');

            switch (choice) {
                case '1':
                    await listUsers();
                    break;
                case '2':
                    await listBands();
                    break;
                case '3':
                    await listSongs();
                    break;
                case '4':
                    await deleteUser();
                    break;
                case '5':
                    await deleteBand();
                    break;
                case '6':
                    await deleteSong();
                    break;
                case '7':
                    await cleanupOrphanedData();
                    break;
                case '8':
                    await showStats();
                    break;
                case '9':
                    log('Goodbye!', 'green');
                    rl.close();
                    process.exit(0);
                default:
                    log('Invalid choice. Please try again.', 'red');
            }


        }
    } catch (error) {
        log(`Error: ${error.message}`, 'red');
        rl.close();
        process.exit(1);
    }
}

// Handle command line arguments for non-interactive mode
if (process.argv.length > 2) {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        try {
            // Check if this is a server command
            if (command === 'server') {
                const serverCommand = args[0];
                if (!serverCommand) {
                    log('Usage: npm run manage server <command>', 'red');
                    log('Example: npm run manage server list-bands', 'yellow');
                    process.exit(1);
                }

                const { exec } = require('child_process');
                const sshCommand = `ssh ${HOST_USER}@${HOST_DOMAIN} "${SETLIST_PATH}/manage-server.sh ${serverCommand}"`;

                exec(sshCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Error connecting to server:', error.message);
                        process.exit(1);
                    }
                    if (stderr) {
                        console.error('Server error:', stderr);
                    }
                    if (stdout) {
                        console.log(stdout);
                    }
                });
                return;
            }

            await require('./models').sequelize.sync();

            switch (command) {
                case 'list-users':
                    await listUsers();
                    break;
                case 'list-bands':
                    await listBands();
                    break;
                case 'list-songs':
                    await listSongs();
                    break;
                case 'stats':
                    await showStats();
                    break;
                case 'cleanup':
                    await cleanupOrphanedData();
                    break;
                default:
                    log(`Unknown command: ${command}`, 'red');
                    log('Available commands: list-users, list-bands, list-songs, stats, cleanup', 'yellow');
                    log('For server commands: npm run manage server <command>', 'yellow');
            }

            process.exit(0);
        } catch (error) {
            log(`Error: ${error.message}`, 'red');
            process.exit(1);
        }
    })();
} else {
    main();
} 