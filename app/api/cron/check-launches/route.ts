import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase-server';

const VANDENBERG_LOCATION_ID = 11;
const VANDENBERG_LAT = 34.63;
const VANDENBERG_LNG = -120.61;
const VANDENBERG_TZ = 'America/Los_Angeles';

const MAX_CLOUD_COVER = 40;
const MAX_PRECIP_PROBABILITY = 20;
const TWILIGHT_WINDOW_MINUTES = 90;

interface LaunchResult {
  id: string;
  name: string;
  net: string;
  status: { name: string; abbrev: string };
  rocket: { configuration: { full_name: string } };
  mission: { name: string; description: string } | null;
  pad: { name: string };
}

interface LaunchApiResponse {
  count: number;
  results: LaunchResult[];
}

interface OpenMeteoResponse {
  daily: { sunrise: string[]; sunset: string[] };
  hourly: { time: string[]; cloud_cover: number[]; precipitation_probability: number[] };
}

async function fetchUpcomingVandenbergLaunches(): Promise<LaunchResult[]> {
  const url = new URL('https://ll.thespacedevs.com/2.2.0/launch/upcoming/');
  url.searchParams.set('location__ids', String(VANDENBERG_LOCATION_ID));
  url.searchParams.set('limit', '10');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Launch Library API error: ${res.status}`);
  }

  const data: LaunchApiResponse = await res.json();
  return data.results;
}

async function fetchWeatherAndSunset(dateStr: string): Promise<OpenMeteoResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(VANDENBERG_LAT));
  url.searchParams.set('longitude', String(VANDENBERG_LNG));
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('hourly', 'cloud_cover,precipitation_probability');
  url.searchParams.set('timezone', VANDENBERG_TZ);
  url.searchParams.set('start_date', dateStr);
  url.searchParams.set('end_date', dateStr);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }

  return res.json();
}

function isWithinTwilightWindow(launchTimeUtc: string, sunsetLocal: string): boolean {
  const launchMs = new Date(launchTimeUtc).getTime();
  const sunsetMs = new Date(sunsetLocal).getTime();
  const diffMinutes = (launchMs - sunsetMs) / (1000 * 60);
  // Launch is within the window if it's from TWILIGHT_WINDOW_MINUTES before
  // sunset to TWILIGHT_WINDOW_MINUTES after sunset
  return diffMinutes >= -TWILIGHT_WINDOW_MINUTES && diffMinutes <= TWILIGHT_WINDOW_MINUTES;
}

function getCloudCoverAtHour(weather: OpenMeteoResponse, launchTimeUtc: string): {
  cloudCover: number;
  precipProbability: number;
} {
  const launchDate = new Date(launchTimeUtc);
  const launchLocalIso = launchDate.toLocaleString('sv-SE', { timeZone: VANDENBERG_TZ });
  const launchHourStr = launchLocalIso.slice(0, 13).replace(' ', 'T') + ':00';

  const hourIndex = weather.hourly.time.indexOf(launchHourStr);
  if (hourIndex === -1) {
    return { cloudCover: 100, precipProbability: 100 };
  }

  return {
    cloudCover: weather.hourly.cloud_cover[hourIndex],
    precipProbability: weather.hourly.precipitation_probability[hourIndex],
  };
}

function formatLaunchTime(utcTime: string): string {
  return new Date(utcTime).toLocaleString('en-US', {
    timeZone: VANDENBERG_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildCardDescription(launch: LaunchResult, conditions: {
  cloudCover: number;
  precipProbability: number;
  sunset: string;
}): string {
  const missionDesc = launch.mission?.description || 'No mission details available.';
  const sunsetFormatted = new Date(conditions.sunset).toLocaleString('en-US', {
    timeZone: VANDENBERG_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return [
    `🚀 ${launch.rocket.configuration.full_name}`,
    `📍 ${launch.pad.name}, Vandenberg SFB`,
    `🕐 Launch: ${formatLaunchTime(launch.net)}`,
    `🌅 Sunset: ${sunsetFormatted}`,
    `☁️ Cloud cover: ${conditions.cloudCover}%`,
    `🌧️ Precip chance: ${conditions.precipProbability}%`,
    ``,
    `Status: ${launch.status.name}`,
    ``,
    missionDesc,
    ``,
    `Tip: Look west after sunset for the exhaust plume lit by the sun — it glows against the darkening sky.`,
  ].join('\n');
}

async function getOrCreateNotificationsList(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', userId)
    .eq('title', 'Notifications')
    .eq('board', 'personal')
    .eq('archived', false)
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: maxPos } = await supabase
    .from('lists')
    .select('position')
    .eq('user_id', userId)
    .eq('board', 'personal')
    .eq('archived', false)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxPos?.position ?? 0) + 1;

  const { data: newList, error } = await supabase
    .from('lists')
    .insert({
      title: 'Notifications',
      position: nextPosition,
      width: 320,
      board: 'personal',
      archived: false,
      shared: false,
      minimized: false,
      user_id: userId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create Notifications list: ${error.message}`);
  return newList!.id;
}

async function getNextCardPosition(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  listId: string,
): Promise<number> {
  const { data } = await supabase
    .from('cards')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  return (data?.position ?? 0) + 1;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Supabase not configured' },
      { status: 500 },
    );
  }

  try {
    const launches = await fetchUpcomingVandenbergLaunches();
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const upcomingLaunches = launches.filter((l) => {
      const launchTime = new Date(l.net).getTime();
      return launchTime > now.getTime() && launchTime < now.getTime() + sevenDaysMs;
    });

    if (upcomingLaunches.length === 0) {
      return NextResponse.json({ message: 'No upcoming Vandenberg launches in the next 7 days', notified: 0 });
    }

    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users?.users?.length) {
      return NextResponse.json({ message: 'No users found', notified: 0 });
    }

    let totalNotified = 0;
    const results: string[] = [];

    for (const launch of upcomingLaunches) {
      const launchDate = new Date(launch.net);
      const dateStr = launchDate.toLocaleDateString('sv-SE', { timeZone: VANDENBERG_TZ });

      let weather: OpenMeteoResponse;
      try {
        weather = await fetchWeatherAndSunset(dateStr);
      } catch {
        results.push(`Skipped ${launch.name}: weather API error`);
        continue;
      }

      const sunset = weather.daily.sunset[0];
      if (!isWithinTwilightWindow(launch.net, sunset)) {
        results.push(`Skipped ${launch.name}: not in twilight window`);
        continue;
      }

      const { cloudCover, precipProbability } = getCloudCoverAtHour(weather, launch.net);
      if (cloudCover > MAX_CLOUD_COVER) {
        results.push(`Skipped ${launch.name}: cloud cover ${cloudCover}% > ${MAX_CLOUD_COVER}%`);
        continue;
      }
      if (precipProbability > MAX_PRECIP_PROBABILITY) {
        results.push(`Skipped ${launch.name}: precip ${precipProbability}% > ${MAX_PRECIP_PROBABILITY}%`);
        continue;
      }

      for (const user of users.users) {
        const { data: alreadyNotified } = await supabase
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .eq('launch_id', launch.id)
          .limit(1)
          .single();

        if (alreadyNotified) continue;

        const listId = await getOrCreateNotificationsList(supabase, user.id);
        const position = await getNextCardPosition(supabase, listId);

        const title = `🚀 ${launch.rocket.configuration.full_name}: ${launch.mission?.name ?? 'Unknown Mission'} — ${formatLaunchTime(launch.net)}`;
        const description = buildCardDescription(launch, { cloudCover, precipProbability, sunset });

        const { error: cardError } = await supabase
          .from('cards')
          .insert({
            title,
            description,
            position,
            list_id: listId,
            completed: false,
            user_id: user.id,
          });

        if (cardError) {
          results.push(`Failed to create card for user ${user.id}: ${cardError.message}`);
          continue;
        }

        await supabase
          .from('notification_log')
          .insert({ user_id: user.id, launch_id: launch.id });

        totalNotified++;
        results.push(`Notified user ${user.id} about ${launch.name}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${upcomingLaunches.length} launches`,
      notified: totalNotified,
      details: results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
