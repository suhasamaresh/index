import { NextRequest, NextResponse } from "next/server";
import { validatePgConnection } from "lib/db-validator";

export async function POST(req: NextRequest, res:NextResponse){
    const creds = await req.json();
    const result = await validatePgConnection(creds);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}