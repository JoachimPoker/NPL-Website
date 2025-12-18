import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300; 

// Initialize Admin Client (Bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { snapshots, league } = await req.json();

    if (!snapshots || !Array.isArray(snapshots)) {
      return NextResponse.json({ ok: false, error: "Invalid data format" }, { status: 400 });
    }

    console.log(`Received batch of ${snapshots.length} files...`);

    // 1. Collect all Player IDs and Names
    const allIds = new Set<string>();
    
    snapshots.forEach((snap: any) => {
        snap.rows.forEach((row: any) => {
            if (row.player_id) {
                // Your DB uses 'text' for id, so we ensure it's a string
                allIds.add(String(row.player_id).trim());
            }
        });
    });

    const idsArray = Array.from(allIds);
    console.log(`Processing ${idsArray.length} unique Player IDs...`);

    // 2. Fetch existing players by ID to avoid duplicates
    const existingMap = new Map<string, string>(); 
    
    if (idsArray.length > 0) {
        // Your players table uses 'id' (text), which matches the Excel 'player_id'
        const { data: existingPlayers, error: fetchErr } = await supabaseAdmin
            .from("players")
            .select("id")
            .in("id", idsArray);
        
        if (!fetchErr) {
            existingPlayers?.forEach(p => existingMap.set(String(p.id), String(p.id)));
        }
    }

    // 3. Prepare New Players
    // If the ID isn't in the DB, we create it.
    const newPlayers = [];
    
    // Helper to find the name for an ID from the snapshot data
    const getNameForId = (id: string) => {
        for (const snap of snapshots) {
            const found = snap.rows.find((r: any) => String(r.player_id).trim() === id);
            if (found && found.name) return found.name;
        }
        return `Unknown Player ${id}`;
    };

    idsArray.forEach(id => {
        if (!existingMap.has(id)) {
            newPlayers.push({
                id: id, // We use the Excel ID as the Database ID
                display_name: getNameForId(id)
            });
        }
    });

    let newPlayerCount = 0;
    if (newPlayers.length > 0) {
        console.log(`Creating ${newPlayers.length} new players...`);
        const { error: insertErr } = await supabaseAdmin
            .from("players")
            .insert(newPlayers);
            
        if (insertErr) {
            throw new Error(`Failed to create players: ${insertErr.message}`);
        }
        newPlayerCount = newPlayers.length;
    }

    // 4. Build Leaderboard Data
    const validInsertRows: any[] = [];

    snapshots.forEach((snap: any) => {
        snap.rows.forEach((row: any) => {
            const pid = row.player_id ? String(row.player_id).trim() : null;
            
            if (pid) {
                // VALIDATING COLUMNS AGAINST YOUR SCHEMA:
                // id, player_id, league, position, points, snapshot_date, created_at
                validInsertRows.push({
                    player_id: pid,
                    league: league, 
                    snapshot_date: snap.date,
                    position: row.rank,
                    points: row.points, // 'points' matches numeric column
                    // REMOVED: events_played, wins (Not in your DB schema)
                });
            }
        });
    });

    // 5. Bulk Insert
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < validInsertRows.length; i += CHUNK_SIZE) {
        const chunk = validInsertRows.slice(i, i + CHUNK_SIZE);
        const { error: batchErr } = await supabaseAdmin
            .from("leaderboard_positions")
            .insert(chunk);
        
        if (batchErr) {
            console.error("Batch insert error:", batchErr);
            throw batchErr;
        }
    }

    return NextResponse.json({ 
        ok: true, 
        message: "Import complete", 
        newPlayers: newPlayerCount,
        insertedRows: validInsertRows.length,
        batch_id: `bulk-${Date.now()}` // Fake ID to trigger frontend success
    });

  } catch (e: any) {
    console.error("Bulk Import Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}