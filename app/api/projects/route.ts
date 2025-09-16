import { NextResponse } from "next/server";
import { getProjects } from "@/lib/actions";

export async function GET() {
  try {
    console.log('Projects API called');
    console.log('Environment check:');
    console.log('- NOTION_DB_PROJECTS:', process.env.NOTION_DB_PROJECTS);
    
    console.log('Calling getProjects...');
    const result = await getProjects();
    console.log('getProjects result:', { success: result.success, error: result.success ? null : result.error });
    
    if (result.success) {
      console.log('Raw data received:', JSON.stringify(result.data, null, 2));
      
      // Extract project names and IDs for easy viewing
      const projects = result.data.map((project: any) => ({
        id: project.id,
        name: project.properties?.Name?.title?.[0]?.text?.content || 'Unnamed Project',
        url: project.url
      }));

      console.log('Formatted projects:', projects);
      
      return NextResponse.json({
        success: true,
        projects,
        rawData: result.data
      });
    } else {
      console.error('getProjects failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}