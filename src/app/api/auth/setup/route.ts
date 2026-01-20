/**
 * POST /api/auth/setup
 *
 * Creates organization and user records after Supabase Auth signup.
 * This endpoint is called by the signup page to complete account setup.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, name, companyName } = body;

    if (!userId || !email || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Generate a slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if organization with this slug already exists
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    let organizationId: string;

    if (existingOrg) {
      // Organization exists - add user to it
      organizationId = existingOrg.id;
    } else {
      // Create new organization
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: companyName,
          slug,
        })
        .select("id")
        .single();

      if (orgError || !newOrg) {
        console.error("[Auth Setup] Failed to create organization:", orgError);
        return NextResponse.json(
          { error: "Failed to create organization" },
          { status: 500 }
        );
      }

      organizationId = newOrg.id;
    }

    // Create user record linked to auth.users
    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      organization_id: organizationId,
      email,
      name,
      role: existingOrg ? "agent" : "admin", // First user is admin, others are agents
    });

    if (userError) {
      console.error("[Auth Setup] Failed to create user:", userError);
      return NextResponse.json(
        { error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    console.log(`[Auth Setup] User ${email} created for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      organizationId,
      isNewOrganization: !existingOrg,
    });
  } catch (error) {
    console.error("[Auth Setup] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
