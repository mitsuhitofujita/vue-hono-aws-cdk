# Repository Intent

## Background

This is a personal learning repository for web development technologies.
The project develops a web application deployed on AWS as the cloud platform.
Development is carried out solely by a single developer.
If the web application is completed, it may be used by the developer themselves.

Although the application is intended for personal use only, it implements authentication and route guards to support multi-user access as a proper web application.
Only pay-per-use (on-demand) resources are selected, ensuring that the AWS bill is $0 in any month the application is not used.

The technology stack is largely predetermined, as the primary goal is technical learning.

## Application Purpose

This web application records the prices of purchased items and tracks their cost per month of active use.

For durable goods such as air conditioners, the purchase price is divided by the number of months the item has been in operation, displaying a per-month cost that decreases over time.

### Example

An air conditioner purchased in March 2026 for 100,000 JPY:

| Month          | Months in Operation | Cost per Month |
|----------------|---------------------|----------------|
| March 2026     | 1                   | 100,000 JPY    |
| April 2026     | 2                   | 50,000 JPY     |
| May 2026       | 3                   | 33,333 JPY     |

This concept is analogous to average fixed cost in economics, where the number of months in operation replaces the quantity of output.

## Application Name

tocoop
