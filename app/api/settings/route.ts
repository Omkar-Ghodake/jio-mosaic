import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Settings, { ISettings } from '@/models/Settings';
// WebSocket broadcast removed - System relies on Polling

export async function GET() {
  try {
    await dbConnect();

    // Find the single settings document
    let settings = await Settings.findOne();

    // If it doesn't exist, create it with default values
    if (!settings) {
      settings = await Settings.create({ mode: 'UPLOAD' });
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/settings:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { mode, engine } = body;

    // Validate mode
    const validModes = ['UPLOAD', 'WAITING', 'MOSAIC'];
    if (mode && !validModes.includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Allowed values: UPLOAD, WAITING, MOSAIC' },
        { status: 400 }
      );
    }

    // Validate engine (optional)
    const validEngines = ['AI', 'CANVAS'];
    if (engine && !validEngines.includes(engine)) {
      return NextResponse.json(
        { error: 'Invalid engine. Allowed values: AI, CANVAS' },
        { status: 400 }
      );
    }

    const update: any = { };
    if (mode) update.mode = mode;
    if (engine) update.engine = engine;

    // Update the existing document or create one if missing
    const settings = await Settings.findOneAndUpdate(
      {}, // filter - match any (since we want singleton)
      update, // update
      { new: true, upsert: true, setDefaultsOnInsert: true } // options
    );

    // WebSocket broadcast logic removed. Clients must poll /api/settings.

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/settings:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
