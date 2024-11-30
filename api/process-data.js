export default async function handler(req, res) {
  // Authorization prüfen
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN;

  if (!authHeader || !authHeader === `Bearer ${expectedToken}`) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or missing Authorization header',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Only POST requests are allowed' });
  }

  const { storeurl, documentKey, first_name, last_name, email, phone, timestamp } = req.body;

  if (!storeurl || !documentKey) {
    return res.status(400).json({
      status: 'error',
      message: 'storeurl and documentKey are required',
    });
  }

  const writeUrl = `${storeurl}/${documentKey}`;
  const readUrl = `${storeurl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  console.log('Start processing...');
  console.log('Read URL:', readUrl);
  console.log('Write URL:', writeUrl);

  const authorizationHeader = `Bearer <YOUR_TOKEN>`; // Set your Stape Store Authorization Token

  // Funktion: Daten aus dem Stape Store holen
  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
        },
      });

      console.log('GET Response:', response.status);

      if (response.status === 404) {
        console.log('Profile not found. Returning default structure.');
        return { user_data: { emails: [], names: [], phones: [] } };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data:', JSON.stringify(data, null, 2));

      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error(`Error fetching existing profile: ${error.message}`);
    }
  }

  // Funktion: Daten aktualisieren oder hinzufügen
  function updateProfile(existingProfile) {
    const updatedProfile = { ...existingProfile };

    if (!updatedProfile.emails) updatedProfile.emails = [];
    if (!updatedProfile.names) updatedProfile.names = [];
    if (!updatedProfile.phones) updatedProfile.phones = [];

    // Debug: Arrays vor der Bearbeitung anzeigen
    console.log('Existing Emails:', JSON.stringify(updatedProfile.emails));
    console.log('Existing Phones:', JSON.stringify(updatedProfile.phones));
    console.log('Existing Names:', JSON.stringify(updatedProfile.names));

    // Hilfsfunktion: E-Mail prüfen und hinzufügen, falls sie fehlt
    if (email) {
      const existingEmail = updatedProfile.emails.find((e) => e.email === email);
      if (!existingEmail) {
        console.log('Adding new email:', email);
        updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      } else {
        console.log('Email already exists:', email);
      }
    }

    // Hilfsfunktion: Telefonnummer prüfen und hinzufügen, falls sie fehlt
    if (phone) {
      const existingPhone = updatedProfile.phones.find((p) => p.phone === phone);
      if (!existingPhone) {
        console.log('Adding new phone:', phone);
        updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      } else {
        console.log('Phone already exists:', phone);
      }
    }

    // Hilfsfunktion: Namen prüfen und hinzufügen, falls sie fehlen
    if (first_name && last_name) {
      const existingName = updatedProfile.names.find(
        (n) => n.first_name === first_name && n.last_name === last_name
      );
      if (!existingName) {
        console.log('Adding new name:', `${first_name} ${last_name}`);
        updatedProfile.names.push({ first_name, last_name, timestamp: currentTimestamp });
      } else {
        console.log('Name already exists:', `${first_name} ${last_name}`);
      }
    }

    // Debug: Arrays nach der Bearbeitung anzeigen
    console.log('Updated Emails:', JSON.stringify(updatedProfile.emails));
    console.log('Updated Phones:', JSON.stringify(updatedProfile.phones));
    console.log('Updated Names:', JSON.stringify(updatedProfile.names));

    return updatedProfile;
  }

  // Funktion: Daten im Stape Store speichern
  async function writeProfile(updatedProfile) {
    try {
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
        },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error(`Error writing profile: ${error.message}`);
    }
  }

  // Hauptprozess
  try {
    const existingProfile = await getExistingProfile();
    console.log('Existing Profile:', JSON.stringify(existingProfile, null, 2));

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

    await writeProfile(updatedProfile);

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
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
