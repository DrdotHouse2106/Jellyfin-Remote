/**
 * Ergänzt das von Capacitor erzeugte iOS-Projekt um Einstellungen,
 * die sich nicht über capacitor.config.json setzen lassen:
 *
 *  - URL-Schema "jellyfinremote://" – der QR-Code in den Plugin-Einstellungen
 *    öffnet damit die App und trägt die Server-URL ein.
 *
 * Aufruf: npm run ios:configure (läuft automatisch bei npm run ios:add)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PLIST = 'ios/App/App/Info.plist';
const SCHEME = 'jellyfinremote';

if (!existsSync(PLIST)) {
  console.error(`${PLIST} nicht gefunden – zuerst "npx cap add ios" ausführen.`);
  process.exit(1);
}

let plist = readFileSync(PLIST, 'utf8');

if (plist.includes(`<string>${SCHEME}</string>`)) {
  console.log(`URL-Schema "${SCHEME}://" ist bereits eingetragen.`);
  process.exit(0);
}

const urlTypes = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>me.ulber.jellyfinremote</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${SCHEME}</string>
			</array>
		</dict>
	</array>`;

const end = plist.lastIndexOf('</dict>');
plist = plist.slice(0, end) + urlTypes.trimStart().replace(/^/, '\t') + '\n' + plist.slice(end);
writeFileSync(PLIST, plist);
console.log(`URL-Schema "${SCHEME}://" eingetragen.`);
