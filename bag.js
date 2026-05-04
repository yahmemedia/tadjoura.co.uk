(function () {
  const STORAGE_KEY = 'tadjoura_bag_v1';

  const PRICE_IDS = {
    ge: {
      '3ml': 'price_1TQX9bRq3qmleYFWiKU7HlNp',
      '6ml': 'price_1TQX9uRq3qmleYFWatd0dd27',
      '12ml': 'price_1TQXAARq3qmleYFWODfwJDNQ'
    },
    am: {
      '3ml': 'price_1TQXBSRq3qmleYFW1MrnZz9Q',
      '6ml': 'price_1TQXBnRq3qmleYFWP0TAoOnz',
      '12ml': 'price_1TQXC8Rq3qmleYFWsrEfKMuO'
    },
    lo: {
      '3ml': 'price_1TQXCYRq3qmleYFWS1ymCN5w',
      '6ml': 'price_1TQXD7Rq3qmleYFWzAMu8au4',
      '12ml': 'price_1TQXDSRq3qmleYFW4BIw3X0p'
    },
    me: {
      '3ml': 'price_1TQXEiRq3qmleYFWMi9SHI98',
      '6ml': 'price_1TQXEzRq3qmleYFW92qyXLwf',
      '12ml': 'price_1TQXFSRq3qmleYFWLSDVyDHs'
    },
    ag: {
      '3ml': 'price_1TQXGFRq3qmleYFWWwiliSTi',
      '6ml': 'price_1TQXJERq3qmleYFWAiWjMHDs',
      '12ml': 'price_1TQXKFRq3qmleYFWHNnonGuM'
    },
    sb: {
      '3ml': 'price_1TQXMHRq3qmleYFWL6vwfCsc',
      '6ml': 'price_1TQXMbRq3qmleYFWnd9kASDB',
      '12ml': 'price_1TQXN6Rq3qmleYFWvMjasEW5'
    },
    ns: {
      '3ml': 'price_1TQXNeRq3qmleYFWl1x9kefG',
      '6ml': 'price_1TQXNxRq3qmleYFWezXjcowq',
      '12ml': 'price_1TQXOMRq3qmleYFWHIa1Zm6J'
    }
  };

  const PRODUCT_IDS = {
    ge: {
      '3ml': 'prod_UPLryoku43mWTJ',
      '6ml': 'prod_UPLroGKoSB0Luk',
      '12ml': 'prod_UPLrJQ0sskFBEQ'
    },
    am: {
      '3ml': 'prod_UPLt1fIP4x6xfF',
      '6ml': 'prod_UPLt68EGCeiV03',
      '12ml': 'prod_UPLtqEQuA12yKo'
    },
    lo: {
      '3ml': 'prod_UPLukV3QyXU5uL',
      '6ml': 'prod_UPLuT41EfBITpr',
      '12ml': 'prod_UPLvUBg28Bl2j8'
    },
    me: {
      '3ml': 'prod_UPLwUohVcUfVsF',
      '6ml': 'prod_UPLw92c3kxX5VH',
      '12ml': 'prod_UPLxTXoMyvwO5T'
    },
    ag: {
      '3ml': 'prod_UPLyS6dFdR8ZdQ',
      '6ml': 'prod_UPM1gE8XFSAQym',
      '12ml': 'prod_UPM2BuaihxLeX4'
    },
    sb: {
      '3ml': 'prod_UPM451XJdkcu5s',
      '6ml': 'prod_UPM4NKSrRPyIXL',
      '12ml': 'prod_UPM5vspaTZ7ZEy'
    },
    ns: {
      '3ml': 'prod_UPM5nqeDcstLqG',
      '6ml': 'prod_UPM68OgDA5M98M',
      '12ml': 'prod_UPM6UzHicEkP7w'
    }
  };

  const NAME_TO_CODE = {
    'Golden Euphrates': 'ge',
    'Apollonia Musk': 'am',
    'Lemnos Oud': 'lo',
    'Marmara Elixir': 'me',
    'Abruzzo Gold': 'ag',
    "Sultan's Breath": 'sb',
    "Nomad's Silk": 'ns'
  };

  function normalizeSize(size) {
    const s = String(size || '').trim().toLowerCase();
    if (s === '3' || s === '3ml') return '3ml';
    if (s === '6' || s === '6ml') return '6ml';
    if (s === '12' || s === '12ml') return '12ml';
    return String(size || '').trim();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          const qty = Number(item?.qty ?? item?.quantity ?? 1);
          return {
            ...item,
            qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
          };
        })
        .filter((item) => item && typeof item === 'object');
    } catch {
      return [];
    }
  }

  function save(bag) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(bag) ? bag : []));
    } catch {
    }
  }

  function priceIdForNameSize(name, size) {
    const code = NAME_TO_CODE[String(name || '').trim()];
    if (!code) return null;
    const normalizedSize = normalizeSize(size);
    return PRICE_IDS?.[code]?.[normalizedSize] || null;
  }

  async function checkout(bag) {
    const currentBag = Array.isArray(bag) ? bag : load();
    if (currentBag.length === 0) {
      alert('Your bag is empty.');
      return;
    }

    const items = [];
    for (const item of currentBag) {
      if (item && item.isOffer) {
        alert('Offer items are not supported at checkout yet.');
        return;
      }
      const priceId = item?.priceId || priceIdForNameSize(item?.name, item?.size);
      const quantity = Number(item?.qty);

      if (!priceId) {
        alert('One or more items are missing Stripe Price IDs.');
        return;
      }

      if (!Number.isFinite(quantity) || quantity < 1) {
        alert('One or more items have an invalid quantity.');
        return;
      }

      items.push({ priceId, quantity: Math.floor(quantity) });
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data || !data.url) {
      alert('Checkout failed.');
      return;
    }

    window.location.href = data.url;
  }

  window.TadjouraBag = {
    STORAGE_KEY,
    PRICE_IDS,
    PRODUCT_IDS,
    NAME_TO_CODE,
    normalizeSize,
    load,
    save,
    priceIdForNameSize,
    checkout
  };
})();

