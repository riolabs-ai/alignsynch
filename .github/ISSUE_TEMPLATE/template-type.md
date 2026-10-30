---

name: New template type
about: Propose another content template, and say what it adds to the one shared record
title: "template: "
labels: ["enhancement"]
assignees: ""
---

## The sharing rule

A field that only one template reads stays on that template. The shared record does not grow a
template-specific field to serve a single template, and no template carries a field it never reads.

## What this template adds to the shared record

<!--
The fields this template needs on the record every template shares (`content/record.ts`). If a quiz
and an assessment would both read it, it belongs here; if only this one would, it does not.
-->

## What it keeps to itself, and why no other template reads it

<!--
The fields that stay on this template. The reason no other template reads a field is the argument of
this issue: a field on the shared record that one template ignores is a field every other template
has to satisfy for nothing.
-->

## Closest existing template

<!--
The template this one is most like — a quiz, an assessment — and the diff between them: which parts
are the same shape with different words, and the one thing that is actually new.
-->
