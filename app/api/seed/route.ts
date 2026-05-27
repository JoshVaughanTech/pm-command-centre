import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const owner = session.user.name || 'Josh';

  try {
    // Use a transaction so everything succeeds or fails together
    const result = await prisma.$transaction(async (tx) => {
      // Create 6 projects
      const p1 = await tx.project.create({ data: {
        userId, code: 'ACC-VIN', name: 'Enterprise Access Control Upgrade', client: 'St Vincent Health',
        stage: 'Delivery', phase: 6, health: 86, risk: 'Medium',
        budget: '+4.2%', budgetState: 'good', schedule: '+3 days', scheduleState: 'good',
        next: 'Client witness test pack due', nextWhen: '3:00 PM', owner, contact: 'Amanda Lee', channel: 'Email',
        lastTouch: new Date(Date.now() - 4 * 86400000),
        move: 'Issue witness test pack to Amanda before 3pm.',
        moveBody: 'Four ITPs complete. Controller cutover still pending IT.',
      }});
      const p2 = await tx.project.create({ data: {
        userId, code: 'CCTV-MET', name: 'CCTV Refresh & Network Cutover', client: 'Metro Education Group',
        stage: 'Commissioning', phase: 5, health: 52, risk: 'High',
        budget: '-1.6%', budgetState: 'warn', schedule: '-2 days', scheduleState: 'bad',
        next: 'Switch config awaiting IT approval', nextWhen: '11:30 AM', owner, contact: 'Daniel Carter', channel: 'Teams',
        lastTouch: new Date(Date.now() - 2 * 86400000),
        move: 'Chase Daniel for switch-port confirmation before noon.',
        moveBody: 'Site team blocked until IT signs port config.',
      }});
      const p3 = await tx.project.create({ data: {
        userId, code: 'VMS-NTH', name: 'Visitor Management Rollout', client: 'Northbank Commercial',
        stage: 'Planning', phase: 2, health: 94, risk: 'Low',
        budget: '+8.1%', budgetState: 'good', schedule: 'On track', scheduleState: 'good',
        next: 'Finalise floor-by-floor install plan', nextWhen: 'Fri', owner, contact: 'Sarah Mitchell', channel: 'Email',
        lastTouch: new Date(Date.now() - 1 * 86400000),
        move: 'Confirm floor access dates with Sarah.',
        moveBody: 'Health is strong. A short proactive note keeps it that way.',
      }});
      const p4 = await tx.project.create({ data: {
        userId, code: 'SAF-RIV', name: 'Public Safety Camera Expansion', client: 'Riverside Council',
        stage: 'Delivery', phase: 4, health: 38, risk: 'High',
        budget: '-0.4%', budgetState: 'warn', schedule: '-1 day', scheduleState: 'warn',
        next: 'No update sent for 7 days', nextWhen: 'Overdue', owner, contact: 'Michael Tan', channel: 'Email',
        lastTouch: new Date(Date.now() - 7 * 86400000),
        move: 'Send weekly update before Michael chases.',
        moveBody: 'Seven days without contact. Pre-empt the escalation.',
      }});
      const p5 = await tx.project.create({ data: {
        userId, code: 'INT-WPK', name: 'Intercom & PA System Install', client: 'Westfield Park Tower',
        stage: 'Delivery', phase: 5, health: 71, risk: 'Medium',
        budget: '-3.2%', budgetState: 'warn', schedule: '+1 day', scheduleState: 'good',
        next: 'Confirm riser access for Thursday', nextWhen: 'Wed', owner, contact: 'Lisa Chen', channel: 'Email',
        lastTouch: new Date(Date.now() - 3 * 86400000),
        move: 'Book riser access with building management.',
        moveBody: 'Install on track but riser access unconfirmed.',
      }});
      const p6 = await tx.project.create({ data: {
        userId, code: 'FIR-SYD', name: 'Fire Panel Replacement Program', client: 'Sydney Airport Corp',
        stage: 'Handover', phase: 7, health: 91, risk: 'Low',
        budget: '+2.1%', budgetState: 'good', schedule: 'On track', scheduleState: 'good',
        next: 'Final compliance docs to authority', nextWhen: 'Next Mon', owner, contact: 'James Wright', channel: 'Email',
        lastTouch: new Date(Date.now() - 1 * 86400000),
        move: 'Submit compliance package to Fire Authority.',
        moveBody: 'All testing complete. Paperwork is the last step.',
      }});

      // Create risks
      await tx.risk.createMany({ data: [
        { userId, projectId: p2.id, title: 'IT dependency on switch-port config', severity: 'high', owner: 'Daniel Carter', impact: 'Could delay commissioning 48h', action: 'Call IT before noon' },
        { userId, projectId: p1.id, title: 'Witness testing evidence gap', severity: 'med', owner: 'Site Lead', impact: 'Handover pack at risk', action: 'Generate test pack from ITPs' },
        { userId, projectId: p4.id, title: 'No client update for 7 days', severity: 'high', owner, impact: 'Client likely to chase', action: 'Send update by EOD' },
        { userId, projectId: p5.id, title: 'Riser access not confirmed', severity: 'med', owner: 'Building Mgmt', impact: 'Weekend crew blocked', action: 'Follow up by Wednesday' },
      ]});

      // Create tasks
      await tx.task.createMany({ data: [
        { projectId: p1.id, title: 'Compile ITP evidence into test pack', status: 'done', assignee: owner, completedAt: new Date() },
        { projectId: p1.id, title: 'Email Amanda with test pack', status: 'in_progress', assignee: owner },
        { projectId: p1.id, title: 'Confirm Friday witness window', status: 'todo', assignee: owner },
        { projectId: p2.id, title: 'Call Daniel re: switch port approval', status: 'todo', assignee: owner },
        { projectId: p2.id, title: 'Prepare alt sequence with available stock', status: 'todo', assignee: owner },
        { projectId: p3.id, title: 'Draft floor-by-floor install plan', status: 'in_progress', assignee: owner },
        { projectId: p4.id, title: 'Draft weekly update to Michael', status: 'in_progress', assignee: owner },
        { projectId: p4.id, title: 'Schedule recurring Friday touchpoint', status: 'todo', assignee: owner },
        { projectId: p6.id, title: 'Submit compliance docs to Fire Authority', status: 'todo', assignee: owner },
      ]});

      // Create time entries
      await tx.timeEntry.createMany({ data: [
        { userId, projectId: p1.id, hours: 4, note: 'ITP evidence compilation', date: new Date(Date.now() - 86400000) },
        { userId, projectId: p2.id, hours: 3, note: 'Pre-cutover audit', date: new Date(Date.now() - 2 * 86400000) },
        { userId, projectId: p4.id, hours: 2, note: 'Camera install stage 1', date: new Date(Date.now() - 86400000) },
        { userId, projectId: p5.id, hours: 5, note: 'PA system wiring level 3-5', date: new Date(Date.now() - 86400000) },
        { userId, projectId: p6.id, hours: 3, note: 'Final testing and docs', date: new Date(Date.now() - 2 * 86400000) },
      ]});

      // Create financial entries
      await tx.financialEntry.createMany({ data: [
        { projectId: p1.id, type: 'po', amount: 45000, description: 'Reader hardware + controllers', status: 'approved' },
        { projectId: p1.id, type: 'cost', amount: 12500, description: 'Labour weeks 1-3', status: 'paid' },
        { projectId: p2.id, type: 'po', amount: 62000, description: 'Camera and NVR package', status: 'approved' },
        { projectId: p2.id, type: 'cost', amount: 18500, description: 'Commissioning labour', status: 'pending' },
        { projectId: p4.id, type: 'po', amount: 38000, description: 'Pole cameras + network', status: 'approved' },
        { projectId: p5.id, type: 'po', amount: 28500, description: 'Intercom stations + PA', status: 'approved' },
        { projectId: p6.id, type: 'po', amount: 95000, description: 'Fire panel program', status: 'approved' },
        { projectId: p6.id, type: 'invoice', amount: 95000, description: 'Final invoice', status: 'approved' },
      ]});

      return { projects: 6, risks: 4, tasks: 8, timeEntries: 5, financials: 8 };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
