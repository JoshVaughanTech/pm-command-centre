import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const userName = session.user.name || 'Josh';

  const projects = [
    {
      code: 'ACC-VIN', name: 'Enterprise Access Control Upgrade', client: 'St Vincent Health Precinct',
      stage: 'Delivery', phase: 6, health: 86, risk: 'Medium',
      budget: '+4.2%', budgetState: 'good', schedule: '+3 days', scheduleState: 'good',
      next: 'Client witness test pack due today', nextWhen: '3:00 PM',
      owner: userName, contact: 'Amanda Lee', channel: 'Email', commsAge: 4,
      move: 'Issue the witness test pack to Amanda before 3pm.',
      moveBody: 'Four ITPs are complete and signed off. One dependency (controller cutover) is still pending IT.',
    },
    {
      code: 'CCTV-MET', name: 'CCTV Refresh & Network Cutover', client: 'Metro Education Group',
      stage: 'Commissioning', phase: 5, health: 52, risk: 'High',
      budget: '-1.6%', budgetState: 'warn', schedule: '-2 days', scheduleState: 'bad',
      next: 'Switch config awaiting IT approval', nextWhen: '11:30 AM',
      owner: userName, contact: 'Daniel Carter', channel: 'Teams + Email', commsAge: 2,
      move: 'Chase Daniel for switch-port confirmation before noon.',
      moveBody: 'Site team is mobilised but blocked until IT signs the port config. Each hour of delay pushes commissioning by half a day.',
    },
    {
      code: 'VMS-NTH', name: 'Visitor Management Rollout', client: 'Northbank Commercial',
      stage: 'Planning', phase: 2, health: 94, risk: 'Low',
      budget: '+8.1%', budgetState: 'good', schedule: 'On track', scheduleState: 'good',
      next: 'Finalise floor-by-floor install plan', nextWhen: 'Fri',
      owner: userName, contact: 'Sarah Mitchell', channel: 'Email', commsAge: 1,
      move: 'Confirm floor access dates with Sarah this week.',
      moveBody: 'Health is strong — a short proactive note keeps it that way.',
    },
    {
      code: 'SAF-RIV', name: 'Public Safety Camera Expansion', client: 'Riverside Council',
      stage: 'Delivery', phase: 4, health: 38, risk: 'High',
      budget: '-0.4%', budgetState: 'warn', schedule: '-1 day', scheduleState: 'warn',
      next: 'No update sent for 7 days', nextWhen: 'Overdue',
      owner: userName, contact: 'Michael Tan', channel: 'Email', commsAge: 7,
      move: 'Send weekly update before Michael chases.',
      moveBody: 'Seven days without contact while two site activities have closed out. No escalation yet — pre-empt it.',
    },
    {
      code: 'INT-WPK', name: 'Intercom & PA System Install', client: 'Westfield Park Tower',
      stage: 'Delivery', phase: 5, health: 71, risk: 'Medium',
      budget: '-3.2%', budgetState: 'warn', schedule: '+1 day', scheduleState: 'good',
      next: 'Confirm riser access for Thursday', nextWhen: 'Wed',
      owner: userName, contact: 'Lisa Chen', channel: 'Email', commsAge: 3,
      move: 'Book riser access with building management by Wednesday.',
      moveBody: 'Install is on track but riser access hasn\'t been confirmed. If it slips past Thursday the weekend crew can\'t proceed.',
    },
    {
      code: 'FIR-SYD', name: 'Fire Panel Replacement Program', client: 'Sydney Airport Corp',
      stage: 'Handover', phase: 7, health: 91, risk: 'Low',
      budget: '+2.1%', budgetState: 'good', schedule: 'On track', scheduleState: 'good',
      next: 'Final compliance docs to authority', nextWhen: 'Next Mon',
      owner: userName, contact: 'James Wright', channel: 'Email', commsAge: 1,
      move: 'Submit compliance package to Fire Authority by Monday.',
      moveBody: 'All testing complete. Final paperwork is the last step before handover sign-off.',
    },
  ];

  const createdProjects: Array<{ id: string; code: string }> = [];

  for (const p of projects) {
    const lastTouch = new Date(Date.now() - p.commsAge * 24 * 60 * 60 * 1000);
    const project = await prisma.project.create({
      data: {
        userId,
        code: p.code,
        name: p.name,
        client: p.client,
        stage: p.stage,
        phase: p.phase,
        health: p.health,
        risk: p.risk,
        budget: p.budget,
        budgetState: p.budgetState,
        schedule: p.schedule,
        scheduleState: p.scheduleState,
        next: p.next,
        nextWhen: p.nextWhen,
        owner: p.owner,
        contact: p.contact,
        channel: p.channel,
        lastTouch,
        move: p.move,
        moveBody: p.moveBody,
      },
    });
    createdProjects.push({ id: project.id, code: project.code });
  }

  // Add risks
  const risks = [
    { code: 'CCTV-MET', title: 'IT dependency on switch-port config', severity: 'high', owner: 'Daniel Carter', impact: 'Could delay commissioning 48h', action: 'Call IT before noon, fall back to alt sequence if no response' },
    { code: 'ACC-VIN', title: 'Witness testing evidence gap', severity: 'med', owner: 'Site Lead', impact: 'Handover pack at risk of rejection', action: 'Auto-generate test pack from completed ITPs' },
    { code: 'ACC-VIN', title: 'Reader stock arrival uncertainty', severity: 'med', owner: 'Procurement', impact: 'Install sequence may need to change', action: 'Confirm courier ETA Mon AM; prep alt path' },
    { code: 'SAF-RIV', title: 'No client update for 7 days', severity: 'high', owner: userName, impact: 'Client likely to chase first', action: 'Send weekly update by EOD' },
    { code: 'INT-WPK', title: 'Riser access not yet confirmed', severity: 'med', owner: 'Building Mgmt', impact: 'Weekend install crew can\'t proceed', action: 'Follow up with Lisa Chen by Wednesday' },
  ];

  for (const r of risks) {
    const project = createdProjects.find((p) => p.code === r.code);
    if (!project) continue;
    await prisma.risk.create({
      data: {
        userId,
        projectId: project.id,
        title: r.title,
        severity: r.severity,
        owner: r.owner,
        impact: r.impact,
        action: r.action,
      },
    });
  }

  // Add some tasks
  const tasks = [
    { code: 'ACC-VIN', title: 'Compile ITP evidence into single test pack', status: 'done' },
    { code: 'ACC-VIN', title: 'Email Amanda with test pack + IT dependency note', status: 'in_progress' },
    { code: 'ACC-VIN', title: 'Confirm Friday witness window after IT response', status: 'todo' },
    { code: 'ACC-VIN', title: 'Schedule handover walkthrough for week of 8 June', status: 'todo' },
    { code: 'CCTV-MET', title: 'Call Daniel re: switch port approval', status: 'todo' },
    { code: 'CCTV-MET', title: 'Prepare alt sequence using available stock', status: 'todo' },
    { code: 'CCTV-MET', title: 'Update Friday milestone if IT slips past noon', status: 'todo' },
    { code: 'SAF-RIV', title: 'Summarise last week\'s site activity', status: 'done' },
    { code: 'SAF-RIV', title: 'Draft weekly update to Michael', status: 'in_progress' },
    { code: 'SAF-RIV', title: 'Schedule recurring Friday touchpoint', status: 'todo' },
    { code: 'FIR-SYD', title: 'Compile final compliance documentation', status: 'done' },
    { code: 'FIR-SYD', title: 'Submit to Fire Authority', status: 'todo' },
  ];

  for (const t of tasks) {
    const project = createdProjects.find((p) => p.code === t.code);
    if (!project) continue;
    await prisma.task.create({
      data: {
        projectId: project.id,
        title: t.title,
        status: t.status,
        assignee: userName,
        completedAt: t.status === 'done' ? new Date() : null,
      },
    });
  }

  // Add time entries
  const timeEntries = [
    { code: 'ACC-VIN', hours: 4, note: 'ITP evidence compilation', daysAgo: 1 },
    { code: 'ACC-VIN', hours: 2.5, note: 'Site walkthrough', daysAgo: 3 },
    { code: 'CCTV-MET', hours: 3, note: 'Pre-cutover audit', daysAgo: 2 },
    { code: 'CCTV-MET', hours: 1.5, note: 'Stock verification', daysAgo: 4 },
    { code: 'SAF-RIV', hours: 2, note: 'Camera install stage 1', daysAgo: 1 },
    { code: 'VMS-NTH', hours: 1, note: 'Stakeholder review prep', daysAgo: 0 },
    { code: 'INT-WPK', hours: 5, note: 'PA system wiring level 3-5', daysAgo: 1 },
    { code: 'FIR-SYD', hours: 3, note: 'Final testing and docs', daysAgo: 2 },
  ];

  for (const te of timeEntries) {
    const project = createdProjects.find((p) => p.code === te.code);
    if (!project) continue;
    await prisma.timeEntry.create({
      data: {
        userId,
        projectId: project.id,
        hours: te.hours,
        note: te.note,
        date: new Date(Date.now() - te.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Add financial entries
  const financialEntries = [
    { code: 'ACC-VIN', type: 'po', amount: 45000, description: 'Reader hardware + controllers', status: 'approved' },
    { code: 'ACC-VIN', type: 'cost', amount: 12500, description: 'Labour - week 1-3', status: 'paid' },
    { code: 'ACC-VIN', type: 'cost', amount: 8200, description: 'Cable and containment', status: 'paid' },
    { code: 'CCTV-MET', type: 'po', amount: 62000, description: 'Camera and NVR package', status: 'approved' },
    { code: 'CCTV-MET', type: 'cost', amount: 18500, description: 'Labour - commissioning phase', status: 'pending' },
    { code: 'SAF-RIV', type: 'po', amount: 38000, description: 'Pole cameras + network equipment', status: 'approved' },
    { code: 'SAF-RIV', type: 'cost', amount: 9800, description: 'Stage 1 install labour', status: 'paid' },
    { code: 'INT-WPK', type: 'po', amount: 28500, description: 'Intercom stations + PA amplifiers', status: 'approved' },
    { code: 'INT-WPK', type: 'invoice', amount: 14250, description: 'Progress claim 1 of 2', status: 'pending' },
    { code: 'FIR-SYD', type: 'po', amount: 95000, description: 'Fire panel replacement program', status: 'approved' },
    { code: 'FIR-SYD', type: 'cost', amount: 82000, description: 'Full program costs', status: 'paid' },
    { code: 'FIR-SYD', type: 'invoice', amount: 95000, description: 'Final invoice', status: 'approved' },
  ];

  for (const fe of financialEntries) {
    const project = createdProjects.find((p) => p.code === fe.code);
    if (!project) continue;
    await prisma.financialEntry.create({
      data: {
        projectId: project.id,
        type: fe.type,
        amount: fe.amount,
        description: fe.description,
        status: fe.status,
      },
    });
  }

  await prisma.activityLog.create({
    data: { userId, action: 'create', detail: `Seeded 6 projects, 5 risks, 12 tasks, 8 time entries, 12 financial entries` },
  });

  return NextResponse.json({
    projects: createdProjects.length,
    risks: risks.length,
    tasks: tasks.length,
    timeEntries: timeEntries.length,
    financials: financialEntries.length,
  });
}
