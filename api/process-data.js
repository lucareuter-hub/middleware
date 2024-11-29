export default function handler(req, res) {
  if (req.method === 'POST') {
    const items = req.body.items || [];
    const result = items.map(item => ({
      name: item.name.toUpperCase(),
      value: item.value * 2,
    }));

    res.status(200).json({ success: true, data: result });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
