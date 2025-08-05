-- Script to properly set up the test database with all migrations
-- This is a simplified version for testing that doesn't use CONCURRENTLY

-- First, drop and recreate the test database to ensure clean state
-- Run this manually if needed:
-- DROP DATABASE IF EXISTS ventry_integration_test;
-- CREATE DATABASE ventry_integration_test;

-- For now, let's just ensure RLS is properly set up after the schema is created