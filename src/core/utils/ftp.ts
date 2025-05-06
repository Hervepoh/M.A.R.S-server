import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { FTP_HOST, FTP_PASSWORD, FTP_USER , FTP_PORT , FTP_LOCAL_PATH, FTP_REMOTE_PATH, FTP_BACKUP_PATH} from '../../secrets';


const host = FTP_HOST;
const username = FTP_USER;
const password = FTP_PASSWORD;
const port = FTP_PORT; 
const localFilePath = FTP_LOCAL_PATH;
const remoteFilePath = FTP_REMOTE_PATH;
const backupDir = FTP_BACKUP_PATH; 
const logFilePath = './upload_log.txt'; // Chemin du fichier de log

const conn = new Client();

// Fonction pour écrire dans le fichier de log
const logMessage = (message: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `${timestamp} - ${message}\n`, 'utf8');
};

conn.on('ready', () => {
    logMessage('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) {
            logMessage(`Erreur lors de l'ouverture de SFTP : ${err.message}`);
            throw err;
        }

        // Envoyer le fichier
        sftp.fastPut(localFilePath, remoteFilePath, {}, (err) => {
            if (err) {
                logMessage(`Erreur lors de l'envoi du fichier : ${err.message}`);
                throw err;
            }
            logMessage('Fichier envoyé avec succès !');

            // Déplacer le fichier vers le dossier de sauvegarde
            const date = new Date().toISOString().split('T')[0]; // Formater la date
            const fileName = path.basename(localFilePath);
            const backupFilePath = path.join(backupDir, `${fileName}_${date}`); // Nouveau chemin avec date

            sftp.rename(remoteFilePath, backupFilePath, (err) => {
                if (err) {
                    logMessage(`Erreur lors du déplacement du fichier : ${err.message}`);
                    throw err;
                }
                logMessage(`Fichier déplacé vers le dossier de sauvegarde : ${backupFilePath}`);
                conn.end();
            });
        });
    });
}).connect({
    host: host,
    port: port,
    username: username,
    password: password
});