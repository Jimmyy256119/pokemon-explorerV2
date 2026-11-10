const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "Public")));

/* =========================
   GET BASIC POKEMON DATA
========================= */

app.get("/api/pokemon", async (req, res) => {
    try {
        const search = req.query.search || "pikachu";

        const response = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(
                search.toLowerCase()
            )}`
        );

        if (!response.ok) {
            return res.status(404).json({
                error: "ไม่พบ Pokémon ตัวนี้"
            });
        }

        const data = await response.json();

        res.json(formatPokemon(data));

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "เกิดข้อผิดพลาดในการเชื่อมต่อ API"
        });
    }
});


/* =========================
   GET EVOLUTION + FORMS
========================= */

app.get("/api/pokemon/:name/family", async (req, res) => {
    try {
        const name = req.params.name.toLowerCase();

        // Get Pokémon first
        const pokemonResponse = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`
        );

        if (!pokemonResponse.ok) {
            return res.status(404).json({
                error: "ไม่พบ Pokémon"
            });
        }

        const pokemonData = await pokemonResponse.json();

        // Get species
        const speciesResponse = await fetch(
            pokemonData.species.url
        );

        const speciesData = await speciesResponse.json();

        /* =========================
           EVOLUTION CHAIN
        ========================= */

        const evolutionResponse = await fetch(
            speciesData.evolution_chain.url
        );

        const evolutionData = await evolutionResponse.json();

        const evolutionNames = [];

        function collectEvolution(chain) {
            if (!chain) return;

            evolutionNames.push(chain.species.name);

            if (chain.evolves_to && chain.evolves_to.length > 0) {
                chain.evolves_to.forEach(next => {
                    collectEvolution(next);
                });
            }
        }

        collectEvolution(evolutionData.chain);

        // Remove duplicates
        const uniqueEvolutionNames = [
            ...new Set(evolutionNames)
        ];

        const evolutionPokemon = await Promise.all(
            uniqueEvolutionNames.map(async pokemonName => {
                try {
                    const response = await fetch(
                        `https://pokeapi.co/api/v2/pokemon/${pokemonName}`
                    );

                    if (!response.ok) return null;

                    const data = await response.json();

                    return {
                        id: data.id,
                        name: data.name,
                        image:
                            data.sprites.other?.["official-artwork"]
                                ?.front_default ||
                            data.sprites.front_default,
                        types: data.types.map(type => type.type.name)
                    };

                } catch {
                    return null;
                }
            })
        );

        /* =========================
           FORMS / VARIETIES
        ========================= */

        const varieties = speciesData.varieties || [];

        const forms = await Promise.all(
            varieties.map(async variety => {
                try {
                    const response = await fetch(
                        variety.pokemon.url
                    );

                    if (!response.ok) return null;

                    const data = await response.json();

                    return {
                        id: data.id,
                        name: data.name,
                        image:
                            data.sprites.other?.["official-artwork"]
                                ?.front_default ||
                            data.sprites.front_default,
                        types: data.types.map(type => type.type.name)
                    };

                } catch {
                    return null;
                }
            })
        );

        res.json({
            evolution: evolutionPokemon.filter(Boolean),
            forms: forms.filter(Boolean)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "ไม่สามารถโหลด Evolution / Forms ได้"
        });
    }
});


/* =========================
   FORMAT POKEMON
========================= */

function formatPokemon(data) {
    return {
        id: data.id,

        name: data.name,

        image:
            data.sprites.other?.["official-artwork"]
                ?.front_default ||
            data.sprites.front_default,

        height: data.height,

        weight: data.weight,

        types: data.types.map(type => type.type.name),

        stats: {
            hp: data.stats[0].base_stat,
            attack: data.stats[1].base_stat,
            defense: data.stats[2].base_stat,
            specialAttack: data.stats[3].base_stat,
            specialDefense: data.stats[4].base_stat,
            speed: data.stats[5].base_stat
        }
    };
}
/* =========================
   AUTOCOMPLETE (Trie)
========================= */

class Trie {
    constructor() {
        this.root = { kids: {}, end: false };
    }

    insert(word) {
        let node = this.root;
        for (const ch of word) {
            node = node.kids[ch] ??= { kids: {}, end: false };
        }
        node.end = true;
    }

    startsWith(prefix, limit = 8) {
        let node = this.root;
        for (const ch of prefix) {
            node = node.kids[ch];
            if (!node) return [];
        }

        const out = [];
        const walk = (n, text) => {
            if (out.length >= limit) return;
            if (n.end) out.push(text);
            for (const ch of Object.keys(n.kids).sort()) {
                walk(n.kids[ch], text + ch);
            }
        };

        walk(node, prefix);
        return out;
    }
}

const trie = new Trie();
let namesPromise = null;

// โหลดรายชื่อครั้งเดียว แล้วสร้าง Trie ครั้งเดียว
function loadNames() {
    namesPromise ??= fetch("https://pokeapi.co/api/v2/pokemon?limit=2000")
        .then(r => {
            if (!r.ok) throw new Error("PokeAPI error");
            return r.json();
        })
        .then(data => data.results.forEach(p => trie.insert(p.name)))
        .catch(err => {
            namesPromise = null; // ให้ลองใหม่ได้
            throw err;
        });
    return namesPromise;
}

app.get("/api/search", async (req, res) => {
    try {
        const q = String(req.query.q || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");

        if (!/^[a-z0-9-]{1,40}$/.test(q)) {
            return res.status(400).json({
                error: "พิมพ์ได้เฉพาะ a-z, 0-9 และ -"
            });
        }

        await loadNames();
        res.json({ results: trie.startsWith(q, 8) });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "ค้นหาไม่ได้ ลองใหม่อีกครั้ง"
        });
    }
});
if (require.main === module) {
    const PORT = process.env.PORT || 3001;

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;