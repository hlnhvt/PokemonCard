// Database of Pokemon Cards with rich stats, lore, moves, media, and video showcases
export const POKEMON_CARDS = [
  {
    id: "charizard-vmax",
    pokedexNumber: "006",
    name: "Charizard VMAX",
    japaneseName: "リザードンVMAX",
    species: "Flame Pokémon",
    types: ["Fire", "Flying"],
    hp: 330,
    rarity: "Secret Rare Rainbow / Hyper",
    cardSet: "Darkness Ablaze / Champion's Path",
    cardNumber: "020/189",
    illustrator: "aky CG Works",
    themeColor: {
      primary: "#FF4422",
      secondary: "#FFAA00",
      accent: "#FF2200",
      glow: "rgba(255, 68, 34, 0.6)"
    },
    image: "https://images.pokemontcg.io/swsh3/20_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png",
    // Short impressive video clip
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    videoShowcase: {
      title: "G-MAX WILDFIRE SURGE",
      duration: 5,
      soundEffect: "fire-blast",
      description: "Charizard phóng thích ngọn lửa Gigantamax 10,000°C thiêu rụi toàn bộ chiến trường!",
      canvasStyle: "fire"
    },
    height: "1.7 m",
    weight: "90.5 kg",
    weakness: { type: "Water", value: "×2" },
    resistance: { type: "Fighting", value: "-30" },
    retreatCost: 3,
    ability: {
      name: "Battle Sense",
      type: "Ability",
      text: "Một lần trong lượt, bạn có thể nhìn 3 lá bài đầu bộ bài, chọn 1 lá vào tay và bỏ 2 lá còn lại vào mộ."
    },
    attacks: [
      {
        name: "Claw Slash",
        cost: ["Colorless", "Colorless", "Colorless"],
        damage: "100",
        description: "Cào xé đối thủ với móng vuốt rực lửa."
      },
      {
        name: "G-Max Wildfire",
        cost: ["Fire", "Fire", "Fire", "Colorless", "Colorless"],
        damage: "300",
        description: "Loại bỏ 2 Thẻ Năng Lượng Lửa khỏi Charizard này để tung đòn hủy diệt tối thượng."
      }
    ],
    lore: "Charizard bay lượn trên bầu trời để tìm kiếm những đối thủ mạnh mẽ. Hơi thở của nó tỏa ra ngọn lửa nóng đến mức có thể làm tan chảy những tảng đá khổng lồ.",
    keywords: ["charizard", "vmax", "lizardo", "006", "fire", "wildfire", "flame"]
  },
  {
    id: "pikachu-vmax",
    pokedexNumber: "025",
    name: "Pikachu VMAX",
    japaneseName: "ピカチュウVMAX",
    species: "Mouse Pokémon",
    types: ["Electric"],
    hp: 310,
    rarity: "Secret Rare Rainbow",
    cardSet: "Vivid Voltage",
    cardNumber: "188/185",
    illustrator: "aky CG Works",
    themeColor: {
      primary: "#FFCC33",
      secondary: "#FFE875",
      accent: "#FF9900",
      glow: "rgba(255, 204, 51, 0.6)"
    },
    image: "https://images.pokemontcg.io/swsh4/188_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    videoShowcase: {
      title: "G-MAX VOLT TACKLE 1,000,000V",
      duration: 5,
      soundEffect: "thunder-volt",
      description: "Pikachu Gigantamax tích tụ nguồn điện khổng lồ triệu hồi sấm sét rung chuyển trời đất!",
      canvasStyle: "thunder"
    },
    height: "0.4 m",
    weight: "6.0 kg",
    weakness: { type: "Fighting", value: "×2" },
    resistance: { type: "Metal", value: "-30" },
    retreatCost: 2,
    ability: null,
    attacks: [
      {
        name: "Charge",
        cost: ["Electric"],
        damage: "-",
        description: "Tìm kiếm trong bộ bài tối đa 2 lá Năng Lượng Điện và gắn vào Pikachu này."
      },
      {
        name: "G-Max Volt Tackle",
        cost: ["Electric", "Electric", "Electric"],
        damage: "120+",
        description: "Bạn có thể bỏ tất cả Năng Lượng Điện gắn trên Pokemon này. Đòn tấn công gây thêm 150 sát thương (tổng 270 DMG)."
      }
    ],
    lore: "Pikachu tích điện trong hai túi má đỏ rực. Khi nó cảm thấy bị đe dọa hoặc giận dữ, dòng điện hàng triệu vôn sẽ lập tức phóng ra xung quanh.",
    keywords: ["pikachu", "vmax", "electric", "025", "volt", "thunder", "mouse"]
  },
  {
    id: "mewtwo-vstar",
    pokedexNumber: "150",
    name: "Mewtwo VSTAR",
    japaneseName: "ミュウツーVSTAR",
    species: "Genetic Pokémon",
    types: ["Psychic"],
    hp: 280,
    rarity: "Ultra Rare Secret Gold",
    cardSet: "Pokémon GO TCG",
    cardNumber: "079/078",
    illustrator: "Planeta Mochizuki",
    themeColor: {
      primary: "#FF5599",
      secondary: "#BB33EE",
      accent: "#9900EE",
      glow: "rgba(255, 85, 153, 0.6)"
    },
    image: "https://images.pokemontcg.io/pgo/79_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    videoShowcase: {
      title: "STAR RAID PSYCHIC ECLIPSE",
      duration: 5,
      soundEffect: "psychic-burst",
      description: "Mewtwo giải phóng năng lượng tâm linh cực hạn bóp méo không gian và vật chất!",
      canvasStyle: "psychic"
    },
    height: "2.0 m",
    weight: "122.0 kg",
    weakness: { type: "Darkness", value: "×2" },
    resistance: { type: "Fighting", value: "-30" },
    retreatCost: 2,
    ability: {
      name: "Star Raid (VSTAR Power)",
      type: "VSTAR Power",
      text: "Đòn tấn công này gây 120 sát thương cho MỌI Pokemon V của đối thủ (không áp dụng Điểm yếu và Kháng cự)."
    },
    attacks: [
      {
        name: "Psy Purge",
        cost: ["Psychic", "Colorless"],
        damage: "90×",
        description: "Bỏ tối đa 3 Năng Lượng Tâm Linh khỏi các Pokemon của bạn. Đòn tấn công gây 90 sát thương cho mỗi lá bài bỏ đi."
      }
    ],
    lore: "Một Pokémon được tạo ra bằng cách tái cấu trúc gen của Mew. Nó được cho là có trái tim tàn bạo nhất trong số các Pokémon và sức mạnh tâm linh không đối thủ.",
    keywords: ["mewtwo", "vstar", "psychic", "150", "genetic", "psy", "raid"]
  },
  {
    id: "rayquaza-vmax",
    pokedexNumber: "384",
    name: "Rayquaza VMAX",
    japaneseName: "レックウザVMAX",
    species: "Sky High Pokémon",
    types: ["Dragon"],
    hp: 320,
    rarity: "Special Art Secret Rare",
    cardSet: "Evolving Skies",
    cardNumber: "218/203",
    illustrator: "Ryuta Fuse",
    themeColor: {
      primary: "#10B981",
      secondary: "#3B82F6",
      accent: "#EAB308",
      glow: "rgba(16, 185, 129, 0.6)"
    },
    image: "https://images.pokemontcg.io/swsh7/218_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/384.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    videoShowcase: {
      title: "DRAGON ASCENT OZONE STORM",
      duration: 5,
      soundEffect: "dragon-roar",
      description: "Rayquaza xé toạc bầu khí quyển tầng ozone, lao xuống như thiên thạch ngọc bích rực sáng!",
      canvasStyle: "dragon"
    },
    height: "7.0 m",
    weight: "206.5 kg",
    weakness: { type: "Fairy", value: "×2" },
    resistance: { type: "None", value: "0" },
    retreatCost: 2,
    ability: {
      name: "Azure Pulse",
      type: "Ability",
      text: "Một lần trong lượt, bạn có thể loại bỏ toàn bộ bài trên tay và rút 3 lá bài mới."
    },
    attacks: [
      {
        name: "Max Burst",
        cost: ["Fire", "Lightning"],
        damage: "20+",
        description: "Bạn có thể bỏ bao nhiêu Năng Lượng Lửa hoặc Điện cơ bản tùy thích khỏi Rayquaza này. Đòn tấn công gây thêm 80 sát thương cho mỗi lá bài bỏ đi."
      }
    ],
    lore: "Rayquaza sống hàng trăm triệu năm trong tầng ozone mà chưa từng đáp xuống mặt đất. Nó hấp thụ các thiên thạch trôi nổi trong không gian để tích lũy sức mạnh.",
    keywords: ["rayquaza", "vmax", "dragon", "384", "sky", "ozone", "burst"]
  },
  {
    id: "gengar-vmax",
    pokedexNumber: "094",
    name: "Gengar VMAX",
    japaneseName: "ゲンガーVMAX",
    species: "Shadow Pokémon",
    types: ["Darkness", "Ghost"],
    hp: 320,
    rarity: "Alternative Art Secret Rare",
    cardSet: "Fusion Strike",
    cardNumber: "271/264",
    illustrator: "Sowsow",
    themeColor: {
      primary: "#8B5CF6",
      secondary: "#4C1D95",
      accent: "#EC4899",
      glow: "rgba(139, 92, 246, 0.6)"
    },
    image: "https://images.pokemontcg.io/swsh8/271_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    videoShowcase: {
      title: "G-MAX SWALLOW UP ABYSS",
      duration: 5,
      soundEffect: "shadow-abyss",
      description: "Chiếc miệng khổng lồ của Gengar Gigantamax mở ra hố đen bóng đêm nuốt chửng linh hồn!",
      canvasStyle: "ghost"
    },
    height: "1.5 m",
    weight: "40.5 kg",
    weakness: { type: "Fighting", value: "×2" },
    resistance: { type: "Psychic", value: "-30" },
    retreatCost: 3,
    ability: null,
    attacks: [
      {
        name: "Fear and Panic",
        cost: ["Darkness", "Darkness"],
        damage: "60×",
        description: "Gây 60 sát thương cho mỗi Pokemon V và Pokemon-GX mà đối thủ đang có trên bàn đấu."
      },
      {
        name: "G-Max Swallow Up",
        cost: ["Darkness", "Darkness", "Darkness"],
        damage: "250",
        description: "Trong lượt kế tiếp, Gengar này không thể sử dụng đòn G-Max Swallow Up."
      }
    ],
    lore: "Gengar ẩn nấp trong bóng râm. Người ta nói rằng khi nhiệt độ xung quanh bạn đột ngột giảm 5 độ C, đó là lúc một con Gengar vừa xuất hiện ngay sau lưng bạn.",
    keywords: ["gengar", "vmax", "ghost", "dark", "094", "shadow", "swallow"]
  },
  {
    id: "greninja-ex",
    pokedexNumber: "658",
    name: "Greninja ex",
    japaneseName: "ゲッコウガex",
    species: "Ninja Pokémon",
    types: ["Water", "Darkness"],
    hp: 300,
    rarity: "Special Illustration Rare",
    cardSet: "Twilight Masquerade",
    cardNumber: "214/167",
    illustrator: "AKIRAMBEGA",
    themeColor: {
      primary: "#0EA5E9",
      secondary: "#1E3A8A",
      accent: "#38BDF8",
      glow: "rgba(14, 165, 233, 0.6)"
    },
    image: "https://images.pokemontcg.io/sv6/214_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/658.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    videoShowcase: {
      title: "SHINOBI WATER SHURIKEN",
      duration: 5,
      soundEffect: "water-slash",
      description: "Greninja dịch chuyển thần tốc, phóng phi tiêu nước nén áp suất xé tan màn đêm!",
      canvasStyle: "water"
    },
    height: "1.5 m",
    weight: "40.0 kg",
    weakness: { type: "Lightning", value: "×2" },
    resistance: { type: "None", value: "0" },
    retreatCost: 1,
    ability: null,
    attacks: [
      {
        name: "Shinobi Blade",
        cost: ["Water"],
        damage: "170",
        description: "Bạn có thể tìm kiếm trong bộ bài 1 lá bài bất kỳ và thêm vào tay. Sau đó xáo lại bộ bài."
      },
      {
        name: "Mirage Barrage",
        cost: ["Water", "Colorless", "Colorless"],
        damage: "120",
        description: "Bỏ 2 Năng Lượng khỏi Greninja ex. Đòn này gây 120 sát thương cho 2 Pokemon bất kỳ của đối thủ."
      }
    ],
    lore: "Greninja tạo ra phi tiêu ném bằng nước nén lại. Khi xoay chúng với tốc độ cao, những phi tiêu này có thể cắt đứt cả kim loại.",
    keywords: ["greninja", "ex", "water", "ninja", "658", "shuriken", "blade"]
  },
  {
    id: "lucario-vstar",
    pokedexNumber: "448",
    name: "Lucario VSTAR",
    japaneseName: "ルカリオVSTAR",
    species: "Aura Pokémon",
    types: ["Fighting", "Steel"],
    hp: 270,
    rarity: "Ultra Rare Secret",
    cardSet: "Crown Zenith",
    cardNumber: "212/159",
    illustrator: "kawayoo",
    themeColor: {
      primary: "#F59E0B",
      secondary: "#0284C7",
      accent: "#EF4444",
      glow: "rgba(245, 158, 11, 0.6)"
    },
    image: "https://images.pokemontcg.io/swsh12pt5/212_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
    videoShowcase: {
      title: "STAR AURA SPHERE BURST",
      duration: 5,
      soundEffect: "aura-blast",
      description: "Lucario đồng bộ tâm trí, ngưng tụ sóng Aura thành quả cầu xung kích cực mạnh!",
      canvasStyle: "aura"
    },
    height: "1.2 m",
    weight: "54.0 kg",
    weakness: { type: "Psychic", value: "×2" },
    resistance: { type: "None", value: "0" },
    retreatCost: 2,
    ability: {
      name: "Star Aura (VSTAR Power)",
      type: "VSTAR Power",
      text: "Đòn tấn công này gây 70 sát thương nhân với số lượng Năng Lượng gắn trên TẤT CẢ Pokemon của đối thủ."
    },
    attacks: [
      {
        name: "Fighting Knuckle",
        cost: ["Fighting", "Colorless", "Colorless"],
        damage: "120+",
        description: "Nếu Pokemon Đang Chiến Đấu của đối thủ là Pokemon V, đòn tấn công gây thêm 120 sát thương (tổng 240 DMG)."
      }
    ],
    lore: "Bằng cách bắt sóng aura phát ra từ mọi sinh vật, Lucario có thể đọc được suy nghĩ, cảm xúc và hành động của đối phương từ khoảng cách hơn nửa dặm.",
    keywords: ["lucario", "vstar", "aura", "fighting", "448", "knuckle", "sphere"]
  },
  {
    id: "blastoise-vmax",
    pokedexNumber: "009",
    name: "Blastoise VMAX",
    japaneseName: "カメックスVMAX",
    species: "Shellfish Pokémon",
    types: ["Water"],
    hp: 330,
    rarity: "Ultra Rare Promo",
    cardSet: "SWSH Black Star Promos",
    cardNumber: "SWSH103",
    illustrator: "PLANETA Tsuji",
    themeColor: {
      primary: "#2563EB",
      secondary: "#60A5FA",
      accent: "#93C5FD",
      glow: "rgba(37, 99, 235, 0.6)"
    },
    image: "https://images.pokemontcg.io/swshp/SWSH103_hires.png",
    fallbackImage: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    videoShowcase: {
      title: "G-MAX HYDRO BOMBARD HYPER CANNON",
      duration: 5,
      soundEffect: "hydro-cannon",
      description: "Hàng chục khẩu đại bác trên mai rùa Blastoise đồng loạt khai hỏa pháo thủy lực!",
      canvasStyle: "water"
    },
    height: "1.6 m",
    weight: "85.5 kg",
    weakness: { type: "Lightning", value: "×2" },
    resistance: { type: "None", value: "0" },
    retreatCost: 3,
    ability: null,
    attacks: [
      {
        name: "Grand Falls",
        cost: ["Water", "Water", "Water"],
        damage: "120",
        description: "Tìm kiếm trong bộ bài tối đa 3 Năng Lượng Nước và gắn vào bất kỳ Pokemon nào của bạn."
      },
      {
        name: "G-Max Bombard",
        cost: ["Water", "Water", "Water", "Water"],
        damage: "220",
        description: "Đòn này cũng gây 30 sát thương cho 2 Pokemon dự bị của đối phương."
      }
    ],
    lore: "Các khẩu pháo nước trên mai của Blastoise có thể bắn ra những tia nước áp lực cực mạnh, đục thủng những tấm thép dày một cách dễ dàng.",
    keywords: ["blastoise", "vmax", "water", "009", "hydro", "bombard", "kamex"]
  }
];

// Helper to find a Pokemon card by keyword, ID or name
export function matchPokemonCard(query) {
  if (!query) return null;
  const cleanQuery = query.toLowerCase().trim();
  
  // Exact ID match
  const exact = POKEMON_CARDS.find(p => p.id === cleanQuery || p.pokedexNumber === cleanQuery);
  if (exact) return exact;

  // Keyword match
  const matched = POKEMON_CARDS.find(p => {
    return p.name.toLowerCase().includes(cleanQuery) ||
           p.keywords.some(k => cleanQuery.includes(k) || k.includes(cleanQuery)) ||
           p.species.toLowerCase().includes(cleanQuery);
  });

  return matched || POKEMON_CARDS[0]; // fallback to Charizard if no match
}
