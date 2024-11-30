export default async function handler(req, res) {
  const { storeurl, documentKey, first_name, last_name, email, phone, timestamp } = req.body;

  if (!storeurl || !documentKey) {
    return res.status(400).json({ status: 'error', message: 'storeurl and documentKey are required' });
  }

  const writeUrl = `${storeurl}/${documentKey}`;
  const readUrl = `${storeurl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) return { emails: [], names: [], phones: [] };
      const data = await response.json();
      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching profile:', error.message);
      throw new Error('Failed to fetch profile.');
    }
  }

  function updateProfile(existingProfile) {
    const updatedProfile = { ...existingProfile };

    updatedProfile.emails = updatedProfile.emails || [];
    updatedProfile.names = updatedProfile.names || [];
    updatedProfile.phones = updatedProfile.phones || [];

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
      updatedProfile.names.push({ first_name, last_name, timestamp: currentTimestamp });
      console.log('Added new name:', `${first_name} ${last_name}`);
    }

    return updatedProfile;
  }

  function isProfileChanged(existingProfile, updatedProfile) {
    const keysToCompare = ['emails', 'names', 'phones'];

    for (const key of keysToCompare) {
      const existingData = existingProfile[key] || [];
      const updatedData = updatedProfile[key] || [];

      if (existingData.length !== updatedData.length) {
        console.log(`${key} length mismatch detected.`);
        return true;
      }

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

  async function writeProfile(updatedProfile) {
    try {
      await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_data: updatedProfile }),
      });
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error('Failed to write profile.');
    }
  }

  try {
    const existingProfile = await getExistingProfile();
    console.log('Existing Profile from Database:', JSON.stringify(existingProfile, null, 2));

    const changesExist = isProfileChanged(existingProfile, updateProfile(existingProfile));

    if (changesExist) {
      console.log('Profile has changed. Writing to Stape Store...');
      const updatedProfile = updateProfile(existingProfile);
      await writeProfile(updatedProfile);
    } else {
      console.log('No changes detected. Skipping write operation.');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profile processed successfully',
    });
  } catch (error) {
    console.error('Processing Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
