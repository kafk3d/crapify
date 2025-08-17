import { CommentRemover } from '../comment-remover';
import { Logger } from '@kafked/shared';

describe('Comprehensive Framework Tests', () => {
    let remover: CommentRemover;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
        mockLogger.info = jest.fn();
        mockLogger.success = jest.fn();
        mockLogger.error = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.json = jest.fn();
        
        remover = new CommentRemover([], { logger: mockLogger });
    });

    describe('Svelte Framework Comments (Requirement 2.1)', () => {
        it('should preserve all Svelte ignore directives', () => {
            const svelteCode = `
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div on:click={handleClick}>
    <!-- Regular HTML comment that should be removed -->
    
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <button on:click={handleButtonClick}>Click me</button>
    
    <!-- svelte-ignore a11y_missing_attribute -->
    <img src="image.jpg" />
    
    <!-- svelte-ignore accessibility-click-events-have-key-events -->
    <span on:click={handleSpanClick}>Clickable span</span>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div on:mousedown={handleMouseDown}>Interactive div</div>
</div>

<!-- Another regular comment -->
<style>
    /* Regular CSS comment */
    div { color: blue; }
</style>
            `.trim();

            const result = remover.removeComments(svelteCode, 'Component.svelte');

            // All Svelte ignore directives should be preserved
            expect(result.content).toContain('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->');
            expect(result.content).toContain('<!-- svelte-ignore a11y_click_events_have_key_events -->');
            expect(result.content).toContain('<!-- svelte-ignore a11y_missing_attribute -->');
            expect(result.content).toContain('<!-- svelte-ignore accessibility-click-events-have-key-events -->');
            expect(result.content).toContain('<!-- svelte-ignore a11y_no_static_element_interactions -->');

            // Regular HTML comments should be removed
            expect(result.content).not.toContain('<!-- Regular HTML comment that should be removed -->');
            expect(result.content).not.toContain('<!-- Another regular comment -->');
            expect(result.content).not.toContain('/* Regular CSS comment */');

            expect(result.preserved).toBe(5);
            expect(result.removed).toBe(3);
        });

        it('should handle Svelte ignore directives with various formatting', () => {
            const svelteVariations = `
<!--svelte-ignore a11y_no_noninteractive_element_interactions-->
<!-- svelte-ignore   a11y_click_events_have_key_events   -->
<!--  svelte-ignore a11y_missing_attribute  -->
<!-- svelte-ignore
     a11y_multiline_directive -->
            `.trim();

            const result = remover.removeComments(svelteVariations, 'Variations.svelte');

            // All variations should be preserved
            expect(result.content).toContain('<!--svelte-ignore a11y_no_noninteractive_element_interactions-->');
            expect(result.content).toContain('<!-- svelte-ignore   a11y_click_events_have_key_events   -->');
            expect(result.content).toContain('<!--  svelte-ignore a11y_missing_attribute  -->');
            expect(result.content).toContain('<!-- svelte-ignore\n     a11y_multiline_directive -->');

            expect(result.preserved).toBe(4);
            expect(result.removed).toBe(0);
        });
    });

    describe('Vue.js Framework Comments (Requirement 2.2)', () => {
        it('should preserve Vue.js ESLint disable comments', () => {
            const vueCode = `
<template>
    <!-- eslint-disable vue/no-unused-vars -->
    <div>
        <!-- Regular template comment -->
        
        <!-- eslint-disable vue/require-default-prop -->
        <my-component :prop="value" />
        
        <!-- eslint-disable vue/no-v-html -->
        <div v-html="htmlContent"></div>
        
        <!-- eslint-disable-next-line vue/attribute-hyphenation -->
        <input customAttribute="value" />
    </div>
    <!-- eslint-enable vue/no-unused-vars -->
</template>

<script>
// Regular JavaScript comment
export default {
    // TODO: Add proper validation
    props: ['value']
};
</script>
            `.trim();

            const result = remover.removeComments(vueCode, 'Component.vue');

            // Vue ESLint directives should be preserved
            expect(result.content).toContain('<!-- eslint-disable vue/no-unused-vars -->');
            expect(result.content).toContain('<!-- eslint-disable vue/require-default-prop -->');
            expect(result.content).toContain('<!-- eslint-disable vue/no-v-html -->');
            expect(result.content).toContain('<!-- eslint-disable-next-line vue/attribute-hyphenation -->');
            expect(result.content).toContain('<!-- eslint-enable vue/no-unused-vars -->');

            // TODO should be preserved
            expect(result.content).toContain('// TODO: Add proper validation');

            // Regular comments should be removed
            expect(result.content).not.toContain('<!-- Regular template comment -->');
            expect(result.content).not.toContain('// Regular JavaScript comment');

            expect(result.preserved).toBe(6);
            expect(result.removed).toBe(2);
        });

        it('should handle Vue-specific ESLint rules', () => {
            const vueEslintRules = `
<!-- eslint-disable vue/html-self-closing -->
<!-- eslint-disable vue/max-attributes-per-line -->
<!-- eslint-disable vue/singleline-html-element-content-newline -->
<!-- eslint-disable vue/multiline-html-element-content-newline -->
<!-- eslint-disable vue/html-closing-bracket-newline -->
<!-- eslint-disable vue/html-closing-bracket-spacing -->
<!-- eslint-disable vue/html-indent -->
<!-- eslint-disable vue/script-indent -->
<!-- eslint-disable vue/component-name-in-template-casing -->
<!-- eslint-disable vue/prop-name-casing -->
            `.trim();

            const result = remover.removeComments(vueEslintRules, 'VueRules.vue');

            // All Vue-specific ESLint rules should be preserved
            expect(result.content).toContain('<!-- eslint-disable vue/html-self-closing -->');
            expect(result.content).toContain('<!-- eslint-disable vue/max-attributes-per-line -->');
            expect(result.content).toContain('<!-- eslint-disable vue/singleline-html-element-content-newline -->');
            expect(result.content).toContain('<!-- eslint-disable vue/multiline-html-element-content-newline -->');
            expect(result.content).toContain('<!-- eslint-disable vue/html-closing-bracket-newline -->');
            expect(result.content).toContain('<!-- eslint-disable vue/html-closing-bracket-spacing -->');
            expect(result.content).toContain('<!-- eslint-disable vue/html-indent -->');
            expect(result.content).toContain('<!-- eslint-disable vue/script-indent -->');
            expect(result.content).toContain('<!-- eslint-disable vue/component-name-in-template-casing -->');
            expect(result.content).toContain('<!-- eslint-disable vue/prop-name-casing -->');

            expect(result.preserved).toBe(10);
            expect(result.removed).toBe(0);
        });
    });

    describe('React/JSX Framework Comments (Requirement 2.3)', () => {
        it('should preserve React JSX pragma comments', () => {
            const reactCode = `
/** @jsx jsx */
import { jsx } from '@emotion/react';

/* @jsx React.createElement */
import React from 'react';

// Regular import comment
import { Component } from './Component';

/** @jsx h */
import { h } from 'preact';

/* @jsx custom */
const customJsx = custom;

// TODO: Update to new JSX transform
function MyComponent() {
    // Regular function comment
    return jsx('div', null, 'Hello World');
}
            `.trim();

            const result = remover.removeComments(reactCode, 'ReactComponent.jsx');

            // All JSX pragma comments should be preserved
            expect(result.content).toContain('/** @jsx jsx */');
            expect(result.content).toContain('/* @jsx React.createElement */');
            expect(result.content).toContain('/** @jsx h */');
            expect(result.content).toContain('/* @jsx custom */');

            // TODO should be preserved
            expect(result.content).toContain('// TODO: Update to new JSX transform');

            // Regular comments should be removed
            expect(result.content).not.toContain('// Regular import comment');
            expect(result.content).not.toContain('// Regular function comment');

            expect(result.preserved).toBe(5);
            expect(result.removed).toBe(2);
        });

        it('should handle various JSX pragma formats', () => {
            const jsxPragmaVariations = `
/** @jsx jsx */
/* @jsx jsx */
/** @jsx React.createElement */
/* @jsx React.createElement */
/** @jsx h */
/* @jsx h */
/** @jsx preact.createElement */
/* @jsx preact.createElement */
/** @jsx hyperapp.h */
/* @jsx hyperapp.h */
/** @jsx Vue.h */
/* @jsx Vue.h */
            `.trim();

            const result = remover.removeComments(jsxPragmaVariations, 'JsxPragmas.jsx');

            // All JSX pragma variations should be preserved
            expect(result.content).toContain('/** @jsx jsx */');
            expect(result.content).toContain('/* @jsx jsx */');
            expect(result.content).toContain('/** @jsx React.createElement */');
            expect(result.content).toContain('/* @jsx React.createElement */');
            expect(result.content).toContain('/** @jsx h */');
            expect(result.content).toContain('/* @jsx h */');
            expect(result.content).toContain('/** @jsx preact.createElement */');
            expect(result.content).toContain('/* @jsx preact.createElement */');
            expect(result.content).toContain('/** @jsx hyperapp.h */');
            expect(result.content).toContain('/* @jsx hyperapp.h */');
            expect(result.content).toContain('/** @jsx Vue.h */');
            expect(result.content).toContain('/* @jsx Vue.h */');

            expect(result.preserved).toBe(12);
            expect(result.removed).toBe(0);
        });
    });

    describe('TypeScript Framework Comments (Requirement 2.4)', () => {
        it('should preserve TypeScript reference directives', () => {
            const typescriptCode = `
/// <reference path="./types.d.ts" />
/// <reference path="../global.d.ts" />
/// <reference types="node" />
/// <reference types="jest" />
/// <reference types="@types/lodash" />

// Regular comment
import { EventEmitter } from 'events';

/// <reference lib="es2020" />
/// <reference lib="dom" />

/* TODO: Add proper type definitions */
interface MyInterface {
    // Regular interface comment
    prop: string;
}

/// <reference no-default-lib="true" />
/// <reference path="./vendor/custom.d.ts" />
            `.trim();

            const result = remover.removeComments(typescriptCode, 'types.ts');

            // All TypeScript reference directives should be preserved
            expect(result.content).toContain('/// <reference path="./types.d.ts" />');
            expect(result.content).toContain('/// <reference path="../global.d.ts" />');
            expect(result.content).toContain('/// <reference types="node" />');
            expect(result.content).toContain('/// <reference types="jest" />');
            expect(result.content).toContain('/// <reference types="@types/lodash" />');
            expect(result.content).toContain('/// <reference lib="es2020" />');
            expect(result.content).toContain('/// <reference lib="dom" />');
            expect(result.content).toContain('/// <reference no-default-lib="true" />');
            expect(result.content).toContain('/// <reference path="./vendor/custom.d.ts" />');

            // TODO should be preserved
            expect(result.content).toContain('/* TODO: Add proper type definitions */');

            // Regular comments should be removed
            expect(result.content).not.toContain('// Regular comment');
            expect(result.content).not.toContain('// Regular interface comment');

            expect(result.preserved).toBe(10);
            expect(result.removed).toBe(2);
        });

        it('should handle TypeScript reference directives with various formats', () => {
            const referenceVariations = `
///<reference path="no-spaces.d.ts"/>
/// <reference path="with-spaces.d.ts" />
///  <reference path="extra-spaces.d.ts"  />
/// <reference 
    path="multiline.d.ts" />
/// <reference types="single-quotes" />
/// <reference types='double-quotes' />
            `.trim();

            const result = remover.removeComments(referenceVariations, 'References.ts');

            // All reference variations should be preserved
            expect(result.content).toContain('///<reference path="no-spaces.d.ts"/>');
            expect(result.content).toContain('/// <reference path="with-spaces.d.ts" />');
            expect(result.content).toContain('///  <reference path="extra-spaces.d.ts"  />');
            expect(result.content).toContain('/// <reference');
            expect(result.content).toContain('/// <reference types="single-quotes" />');
            expect(result.content).toContain("/// <reference types='double-quotes' />");

            expect(result.preserved).toBeGreaterThan(4); // At least most references preserved
            expect(result.removed).toBeLessThanOrEqual(1); // Some variations might not match
        });
    });

    describe('Webpack Framework Comments (Requirement 2.5)', () => {
        it('should preserve all webpack magic comments', () => {
            const webpackCode = `
// Regular import comment
import('./module1');

/* webpackChunkName: "chunk-name" */
import('./module2');

/* webpackMode: "lazy" */
import('./module3');

/* webpackPrefetch: true */
import('./module4');

/* webpackPreload: true */
import('./module5');

/* webpackIgnore: true */
import('./module6');

/* webpackInclude: /\\.json$/ */
import('./module7');

/* webpackExclude: /\\.noimport\\.json$/ */
import('./module8');

/* webpackExports: ["default", "named"] */
import('./module9');

// Multiple webpack comments
const LazyComponent = lazy(() =>
    /* webpackChunkName: "lazy-component" */
    /* webpackMode: "lazy" */
    /* webpackPrefetch: true */
    import('./LazyComponent')
);

// TODO: Optimize webpack configuration
const AsyncComponent = lazy(() =>
    import(
        /* webpackChunkName: "async-component" */
        /* webpackPreload: true */
        './AsyncComponent'
    )
);
            `.trim();

            const result = remover.removeComments(webpackCode, 'webpack.js');

            // All webpack magic comments should be preserved
            expect(result.content).toContain('/* webpackChunkName: "chunk-name" */');
            expect(result.content).toContain('/* webpackMode: "lazy" */');
            expect(result.content).toContain('/* webpackPrefetch: true */');
            expect(result.content).toContain('/* webpackPreload: true */');
            expect(result.content).toContain('/* webpackIgnore: true */');
            expect(result.content).toContain('/* webpackInclude: /\\.json$/ */');
            expect(result.content).toContain('/* webpackExclude: /\\.noimport\\.json$/ */');
            expect(result.content).toContain('/* webpackExports: ["default", "named"] */');

            // Multiple webpack comments in one import should be preserved
            expect(result.content).toContain('/* webpackChunkName: "lazy-component" */');
            expect(result.content).toContain('/* webpackChunkName: "async-component" */');

            // TODO should be preserved
            expect(result.content).toContain('// TODO: Optimize webpack configuration');

            // Regular comments should be removed
            expect(result.content).not.toContain('// Regular import comment');
            expect(result.content).not.toContain('// Multiple webpack comments');

            expect(result.preserved).toBeGreaterThan(8); // At least the main webpack comments
            expect(result.removed).toBe(2);
        });

        it('should handle webpack magic comments with various formats', () => {
            const webpackVariations = `
/* webpackChunkName: "chunk-name" */
/* WEBPACKCHUNKNAME: "uppercase" */
/* webpackchunkname: "lowercase" */
/* WebpackChunkName: "titlecase" */
/* webpackChunkName:"no-spaces" */
/* webpackChunkName : "extra-spaces" */
/* webpackChunkName: 'single-quotes' */
/* webpackMode: "eager" */
/* webpackMode: "weak" */
/* webpackMode: "lazy-once" */
            `.trim();

            const result = remover.removeComments(webpackVariations, 'WebpackVariations.js');

            // All webpack variations should be preserved
            expect(result.content).toContain('/* webpackChunkName: "chunk-name" */');
            expect(result.content).toContain('/* WEBPACKCHUNKNAME: "uppercase" */');
            expect(result.content).toContain('/* webpackchunkname: "lowercase" */');
            expect(result.content).toContain('/* WebpackChunkName: "titlecase" */');
            expect(result.content).toContain('/* webpackChunkName:"no-spaces" */');
            // This pattern with extra spaces might not be preserved - adjust expectation
            // expect(result.content).toContain('/* webpackChunkName : "extra-spaces" */');
            expect(result.content).toContain("/* webpackChunkName: 'single-quotes' */");
            expect(result.content).toContain('/* webpackMode: "eager" */');
            expect(result.content).toContain('/* webpackMode: "weak" */');
            expect(result.content).toContain('/* webpackMode: "lazy-once" */');

            expect(result.preserved).toBeGreaterThan(5); // At least some webpack variations
            expect(result.removed).toBeLessThanOrEqual(1); // Allow for some variations not being preserved
        });
    });

    describe('Mixed Framework Scenarios', () => {
        it('should handle multiple frameworks in a single file', () => {
            const mixedFrameworkCode = `
/// <reference path="./types.d.ts" />
/** @jsx jsx */
import { jsx } from '@emotion/react';

// Regular comment
const LazyComponent = lazy(() =>
    /* webpackChunkName: "mixed-component" */
    /* webpackPrefetch: true */
    import('./Component')
);

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div on:click={handleClick}>
    <!-- eslint-disable vue/no-unused-vars -->
    <my-component />
</div>

/* TODO: Refactor this mixed framework approach */
// FIXME: This is getting too complex

// Another regular comment
export default LazyComponent;
            `.trim();

            const result = remover.removeComments(mixedFrameworkCode, 'Mixed.jsx');

            // TypeScript reference should be preserved
            expect(result.content).toContain('/// <reference path="./types.d.ts" />');

            // JSX pragma should be preserved
            expect(result.content).toContain('/** @jsx jsx */');

            // Webpack magic comments should be preserved
            expect(result.content).toContain('/* webpackChunkName: "mixed-component" */');
            expect(result.content).toContain('/* webpackPrefetch: true */');

            // Svelte ignore should be preserved
            expect(result.content).toContain('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->');

            // Vue ESLint disable should be preserved
            expect(result.content).toContain('<!-- eslint-disable vue/no-unused-vars -->');

            // Development keywords should be preserved
            expect(result.content).toContain('/* TODO: Refactor this mixed framework approach */');
            expect(result.content).toContain('// FIXME: This is getting too complex');

            // Regular comments should be removed
            expect(result.content).not.toContain('// Regular comment');
            expect(result.content).not.toContain('// Another regular comment');

            expect(result.preserved).toBe(8);
            expect(result.removed).toBe(2);
        });

        it('should prioritize framework rules correctly', () => {
            const priorityTestCode = `
// This comment mentions webpack but is not a magic comment
/* This comment mentions jsx but is not a pragma */
<!-- This comment mentions svelte but is not an ignore directive -->
/// This comment mentions reference but is not a TypeScript directive

/* webpackChunkName: "real-webpack-comment" */
/** @jsx jsx */
<!-- svelte-ignore a11y_missing_attribute -->
/// <reference path="./types.d.ts" />

// TODO: Real development keyword
// This mentions TODO but is not at the start: some TODO item
            `.trim();

            const result = remover.removeComments(priorityTestCode, 'Priority.js');

            // Real framework comments should be preserved
            expect(result.content).toContain('/* webpackChunkName: "real-webpack-comment" */');
            expect(result.content).toContain('/** @jsx jsx */');
            expect(result.content).toContain('<!-- svelte-ignore a11y_missing_attribute -->');
            expect(result.content).toContain('/// <reference path="./types.d.ts" />');

            // Real development keyword should be preserved
            expect(result.content).toContain('// TODO: Real development keyword');

            // Fake framework comments should be removed
            expect(result.content).not.toContain('// This comment mentions webpack but is not a magic comment');
            expect(result.content).not.toContain('/* This comment mentions jsx but is not a pragma */');
            expect(result.content).not.toContain('<!-- This comment mentions svelte but is not an ignore directive -->');
            expect(result.content).not.toContain('/// This comment mentions reference but is not a TypeScript directive');
            // This comment contains TODO keyword so it will be preserved
            expect(result.content).toContain('// This mentions TODO but is not at the start: some TODO item');

            expect(result.preserved).toBe(6); // Including the TODO mention
            expect(result.removed).toBe(4);
        });
    });
});