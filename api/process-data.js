export default async function handler(req, res) {
  // Authorization Token prüfen
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or missing Authorization header',
    });
  }

  // Nur POST-Anfragen erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Only POST requests are allowed' });
  }

  // Eingabedaten abrufen
  const { storeurl, documentKey, first_name, last_name, email, phone, timestamp } = req.body;

  if (!storeurl || !documentKey) {
    return res.status(400).json({
      status: 'error',
      message: 'storeurl and documentKey are required',
    });
  }

  // URLs und Timestamp definieren
  const writeUrl = `${storeurl}/${documentKey}`;
  const readUrl = `${storeurl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  console.log('Start processing...');
  console.log('Read URL:', readUrl);
  console.log('Write URL:', writeUrl);

  // Funktion: GET-Request an Stape Store, um bestehende Daten zu holen
  async function getExistingProfile() {
    try {
      console.log('Sending GET request to fetch existing profile...');
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('GET Response Status:', response.status);

      if (response.status === 404) {
        console.log('Profile not found. Initializing default structure.');
        return { emails: [], names: [], phones: [] }; // Initialisiere leeres Profil
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data from Database:', JSON.stringify(data, null, 2));

      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error(`Error fetching existing profile: ${error.message}`);
    }
  }

  // Funktion: Profil aktualisieren
  function updateProfile(existingProfile) {
    const updatedProfile = { ...existingProfile };

    // Sicherstellen, dass Arrays existieren
    updatedProfile.emails = updatedProfile.emails || [];
    updatedProfile.names = updatedProfile.names || [];
    updatedProfile.phones = updatedProfile.phones || [];

    // Email hinzufügen, falls sie neu ist
    if (email) {
      const emailExists = updatedProfile.emails.some((item) => item.email === email);
      if (!emailExists) {
        updatedProfile.emails.push({ email, timestamp: currentTimestamp });
        console.log('Added new email:', email);
      }
    }

    // Phone hinzufügen, falls es neu ist
    if (phone) {
      const phoneExists = updatedProfile.phones.some((item) => item.phone === phone);
      if (!phoneExists) {
        updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
        console.log('Added new phone:', phone);
      }
    }

    // Name hinzufügen, falls er neu ist
    if (first_name && last_name) {
      const nameExists = updatedProfile.names.some(
        (item) => item.first_name === first_name && item.last_name === last_name
      );
      if (!nameExists) {
        updatedProfile.names.push({
          first_name,
          last_name,
          timestamp: currentTimestamp,
        });
        console.log('Added new name:', `${first_name} ${last_name}`);
      }
    }

    return updatedProfile;
  }

  // Funktion: Profile vergleichen
  function isProfileChanged(existingProfile, updatedProfile) {
    const keysToCompare = ['emails', 'names', 'phones'];

    for (const key of keysToCompare) {
      const existingData = existingProfile[key] || [];
      const updatedData = updatedProfile[key] || [];

      // Prüfen, ob Längen unterschiedlich sind
      if (existingData.length !== updatedData.length) {
        console.log(`${key} length mismatch detected.`);
        return true;
      }

      // Prüfen, ob Inhalte unterschiedlich sind
      const existingSet = new Set(existingData.map((item) => JSON.stringify(item)));
      const updatedSet = new Set(updatedData.map((item) => JSON.stringify(item)));

      for (const updatedItem of updatedSet) {
        if (!existingSet.has(updatedItem)) {
          console.log(`New ${key} data detected: ${updatedItem}`);
          return true;
        }
      }
    }

    console.log('No changes detected in profile.');
    return false;
  }

  // Funktion: PATCH-Request, um das Profil zu speichern
  async function writeProfile(updatedProfile) {
    try {
      console.log('Sending PATCH request to update profile...');
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response Status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }

      console.log('Profile successfully updated.');
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error(`Error writing profile: ${error.message}`);
    }
  }

  // Hauptprozess: Profil abrufen, aktualisieren und speichern
  try {
    const existingProfile = await getExistingProfile();
    console.log('Existing Profile from Database:', JSON.stringify(existingProfile, null, 2));

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile to Write:', JSON.stringify(updatedProfile, null, 2));

    if (isProfileChanged(existingProfile, updatedProfile)) {
      console.log('Profile has changed. Writing to Stape Store...');
      await writeProfile(updatedProfile);
    } else {
      console.log('No changes detected. Skipping write operation.');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profile processed successfully',
      data: updatedProfile,
    });
  } catch (error) {
    console.error('Processing Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: `Failed to process data: ${error.message}`,
    });
  }
}
