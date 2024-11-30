export default async function handler(req, res) {
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

  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        console.log('Profile not found. Initializing default structure.');
        return { emails: [], names: [], phones: [] }; // Leeres Profil
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data from Database:', JSON.stringify(data, null, 2));
      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error('Failed to fetch profile.');
    }
  }

  function updateProfile(existingProfile) {
    const updatedProfile = { ...existingProfile };

    updatedProfile.emails = updatedProfile.emails || [];
    updatedProfile.names = updatedProfile.names || [];
    updatedProfile.phones = updatedProfile.phones || [];

    // Hinzufügen neuer Daten, wenn nicht vorhanden
    if (email && !updatedProfile.emails.some((item) => item.email === email)) {
      updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      console.log('Added new email:', email);
    }

    if (phone && !updatedProfile.phones.some((item) => item.phone === phone)) {
      updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      console.log('Added new phone:', phone);
    }

    if (first_name && last_name && !updatedProfile.names.some(
      (item) => item.first_name === first_name && item.last_name === last_name
    )) {
      updatedProfile.names.push({
        first_name,
        last_name,
        timestamp: currentTimestamp,
      });
      console.log('Added new name:', `${first_name} ${last_name}`);
    }

    return updatedProfile;
  }

  function isProfileChanged(existingProfile, updatedProfile) {
    const keysToCompare = ['emails', 'names', 'phones'];

    for (const key of keysToCompare) {
      const existingData = existingProfile[key] || [];
      const updatedData = updatedProfile[key] || [];

      // Prüfen, ob das Array im updatedProfile neue Elemente enthält
      if (updatedData.length > existingData.length) {
        console.log(`Detected new data in ${key}: ${JSON.stringify(updatedData)}`);
        return true;
      }

      // Prüfen, ob sich die Inhalte unterscheiden
      const existingSet = new Set(existingData.map((item) => JSON.stringify(item)));
      for (const updatedItem of updatedData) {
        if (!existingSet.has(JSON.stringify(updatedItem))) {
          console.log(`New item detected in ${key}: ${JSON.stringify(updatedItem)}`);
          return true;
        }
      }
    }

    console.log('No changes detected in profile.');
    return false;
  }

  async function writeProfile(updatedProfile) {
    try {
      console.log('Sending PATCH request to update profile...');
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response Status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }

      console.log('Profile successfully updated.');
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error('Failed to write profile.');
    }
  }

  try {
    const existingProfile = await getExistingProfile();
    console.log('Existing Profile from Database:', JSON.stringify(existingProfile, null, 2));

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

    // Vergleiche bestehendes und aktualisiertes Profil
    const changesExist = isProfileChanged(existingProfile, updatedProfile);

    if (changesExist) {
      console.log('Changes detected. Writing profile...');
      await writeProfile(updatedProfile);
      return res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } else {
      console.log('No changes detected. Skipping write operation.');
      return res.status(200).json({
        status: 'success',
        message: 'No changes detected',
        data: existingProfile,
      });
    }
  } catch (error) {
    console.error('Processing Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
