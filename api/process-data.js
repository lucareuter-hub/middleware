export default async function handler(req, res) {
  const {
    storeurl,
    documentKey,
    first_name,
    last_name,
    email,
    phone,
    timestamp,
  } = req.body;

  console.log('Received request body:', JSON.stringify(req.body, null, 2));

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
        return { emails: [], names: [], phones: [] };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data from Database:', JSON.stringify(data, null, 2));

      return data.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error('Failed to fetch profile.');
    }
  }

  function updateProfile(existingProfile = {}, newData) {
    const { email, phone, first_name, last_name, currentTimestamp } = newData;

    // Deep copy the arrays to prevent modifying existingProfile
    const updatedProfile = {
      emails: [...(existingProfile.emails || [])],
      names: [...(existingProfile.names || [])],
      phones: [...(existingProfile.phones || [])],
    };

    if (
      email &&
      !updatedProfile.emails.some((item) => item.email === email)
    ) {
      updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      console.log('Added new email:', email);
    } else {
      console.log('Email not added (may already exist or undefined):', email);
    }

    if (
      phone &&
      !updatedProfile.phones.some((item) => item.phone === phone)
    ) {
      updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      console.log('Added new phone:', phone);
    } else {
      console.log('Phone not added (may already exist or undefined):', phone);
    }

    if (
      first_name &&
      last_name &&
      !updatedProfile.names.some(
        (item) =>
          item.first_name === first_name && item.last_name === last_name
      )
    ) {
      updatedProfile.names.push({
        first_name,
        last_name,
        timestamp: currentTimestamp,
      });
      console.log('Added new name:', `${first_name} ${last_name}`);
    } else {
      console.log(
        'Name not added (may already exist or undefined):',
        `${first_name} ${last_name}`
      );
    }

    console.log(
      'Updated Profile after additions:',
      JSON.stringify(updatedProfile, null, 2)
    );

    return updatedProfile;
  }

  function isProfileChanged(existingProfile, updatedProfile) {
    console.log('Comparing profiles:');
    console.log('Existing Profile:', JSON.stringify(existingProfile, null, 2));
    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

    const keysToCompare = ['emails', 'names', 'phones'];

    for (const key of keysToCompare) {
      let existingData = existingProfile[key] || [];
      let updatedData = updatedProfile[key] || [];

      if (updatedData.length !== existingData.length) {
        console.log(`Detected change in ${key} length.`);
        return true;
      }

      // Sort arrays to ensure consistent order
      if (key === 'emails') {
        existingData = existingData.slice().sort((a, b) => a.email.localeCompare(b.email));
        updatedData = updatedData.slice().sort((a, b) => a.email.localeCompare(b.email));
      } else if (key === 'phones') {
        existingData = existingData.slice().sort((a, b) => a.phone.localeCompare(b.phone));
        updatedData = updatedData.slice().sort((a, b) => a.phone.localeCompare(b.phone));
      } else if (key === 'names') {
        existingData = existingData.slice().sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name}`;
          const nameB = `${b.first_name} ${b.last_name}`;
          return nameA.localeCompare(nameB);
        });
        updatedData = updatedData.slice().sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name}`;
          const nameB = `${b.first_name} ${b.last_name}`;
          return nameA.localeCompare(nameB);
        });
      }

      for (let i = 0; i < updatedData.length; i++) {
        const existingItem = { ...existingData[i] };
        const updatedItem = { ...updatedData[i] };

        // Remove the timestamp before comparison
        delete existingItem.timestamp;
        delete updatedItem.timestamp;

        if (JSON.stringify(existingItem) !== JSON.stringify(updatedItem)) {
          console.log(
            `Detected change in ${key} at index ${i}.`,
            'Existing item:',
            existingItem,
            'Updated item:',
            updatedItem
          );
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
    const existingProfile = (await getExistingProfile()) || {
      emails: [],
      names: [],
      phones: [],
    };

    console.log(
      'Existing Profile from Database:',
      JSON.stringify(existingProfile, null, 2)
    );

    const updatedProfile = updateProfile(existingProfile, {
      email,
      phone,
      first_name,
      last_name,
      currentTimestamp,
    });

    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

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
