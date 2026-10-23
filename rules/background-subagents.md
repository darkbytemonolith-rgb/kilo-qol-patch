# Background subagent policy

When delegating work to a subagent, task worker, or swarm agent, always start it in background mode using the background option supported by the available tool. Do not launch delegated work as a blocking or foreground task.

After launching background work, continue with independent work and collect the result later when it is needed. Apply this rule to every delegated task, including nested delegation. If the available tool cannot start work in the background, do not delegate that work; handle it directly or explain the limitation.
